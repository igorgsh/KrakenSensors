//--------------------------------
// main function

const config = require('./config.json')
const Gpio = require('onoff').Gpio;
var fs = require('fs')
var logger ;
const { WebSocket } = require('ws');
const ws = new WebSocket(config.wsUrl);

var Sensors = [];


setup();

process.on('SIGINT', _ => {
  
	if (Sensors.length >0) {
		Sensors.forEach( sensor => {
			if (sensor.simulator==0 && 'handle' in sensor) {
				if ('intervalId' in sensor) {
					clearInterval(sensor.intervalId);
				}
				sensor.handle.unwatchAll();
				sensor.handle.unexport();
			}
		});
	};
	logger.end();
});

ws.on('open', function open() {
  ws.send(JSON.stringify('{ "apikey" : "' + config.apiKey + '"}'));
	run();
});

ws.on('message', function message(data) {
//  console.log('received: %s', data);
	// The control message should be like
	// { "sensors" : { "Emergency Switch" : "off", "second switch": 1  }}
	const msg = JSON.parse(data);
	if (msg.sensors != undefined) {
		const s = JSON.stringify(msg.sensors);
		s.split(',').forEach (txt => {
			const nm = txt.split(':')[0].split('"')[1];
			var v = txt.split(':')[1];
			Sensors.forEach( sensor =>{
				if (sensor.name == nm && sensor.type == 'relay') {
					if (v.substring(0) = '"') {
						v=v.split('"')[1];
					}
					if (v == 'off' || v == 0) { 
						sensor.setOff();
					} else {
						sensor.setOn();
					}
				}
			});
		});
	}
});


/*
	Send message to ws server
		name - the name of sensor
		msg - messages send to WS server
*/
function sendMsg(name, msg) {
	var jsonMsg = {};
	jsonMsg['apikey'] = config.apiKey;
	var sensor = {};
	sensor['tStamp'] = Date.now();
	sensor[name] = msg;
	jsonMsg['sensors'] = sensor;
	var txt = JSON.stringify(jsonMsg);
	console.log(txt);
	ws.send(txt);
}

function sendError(name, msg) {
	logWrite('ERR from (' + name + '): ' + msg); 
}


function getCurrentTimeAsString() {
	var today = new Date();
	
	var date = today.toLocaleString('en-US');
	var time = today.toLocaleTimeString('en-US');
  return dateTime = date + ' ' + time;
}

function logWrite(msg) {
	logger.write(getCurrentTimeAsString() + ' ' + msg + '\n');
//	console.log(getCurrentTimeAsString() + ' ' + msg + '\n');	
}



function setup() {
	var n = 0;
	var logName = '/var/log/sensors.log';
	
	if (config != '') {
		
		// init log file
		if ('logFile' in config && config.logFile != '') {
			logName = config.logFile;
		}
		logger = fs.createWriteStream(logName,{  flags: 'a' });
		logWrite('Start');
		// Read configuration of sensors
		if ('sensors' in config) {
			config.sensors.forEach( function (sensor) {
				if ('type' in sensor && sensor.type != '') {
					switch(sensor.type) {
						case 'relay':
							Sensors[n] = new Object;
							Sensors[n].simulator = ('simulator' in sensor ? sensor.simulator : 0);
							Sensors[n].type = sensor.type;
							Sensors[n].name = ('name' in sensor && sensor.name != '' ? sensor.name : 'NoName');
							Sensors[n].port = ('port' in sensor && sensor.port != '' ? sensor.port : 0 );
							Sensors[n].levelOn = ('levelOn' in sensor && sensor.levelOn != '' && (sensor.levelOn=='high' || sensor.levelOn=='low') ? sensor.levelOn : 'low');
							
							if (Sensors[n].simulator==0) { 							
								Sensors[n].handle = new Gpio(Sensors[n].port, 'out');
								Sensors[n].setOn= (_=>{
									sendMsg(Sensors[n].name,'ON');
									Sensors[n].handle.writeSync(Sensors[n].levelOn == 'low' ? 0 : 1);
									});
								Sensors[n].setOff= (_=>{
									sendMsg(Sensors[n].name,'OFF');
									Sensors[n].handle.writeSync(Sensors[n].levelOn == 'low' ? 1 : 0);
									});
							}
							Sensors[n].status = 0;
							break;

						case 'contactor':
							Sensors[n] = new Object;
							Sensors[n].simulator = ('simulator' in sensor ? sensor.simulator : 0);
							Sensors[n].type = sensor.type;
							Sensors[n].name = ('name' in sensor && sensor.name != '' ? sensor.name : 'NoName');
							Sensors[n].port = ('port' in sensor && sensor.port != '' ? sensor.port : 0 );
							Sensors[n].levelOn = ('levelOn' in sensor && sensor.levelOn != '' && (sensor.levelOn=='high' || sensor.levelOn=='low') ? sensor.levelOn : 'low');
							Sensors[n].debounceTm = ('debounceTimeout' in sensor && !isNaN(sensor.debounceTimeout) ? sensor.debounceTimeout : 100);
							
							if (Sensors[n].simulator==0) { 							
								Sensors[n].handle = new Gpio(Sensors[n].port, 'in', 'both', {debounceTimeout: Sensors[n].debounceTm});
								if (sensor.levelOn == 'low') {
									Sensors[n].handle.setActiveLow(true);
								}
							}
							Sensors[n].status = 0;
							break;

						case 'LED_Blink':
							Sensors[n] = new Object;
							Sensors[n].simulator = ('simulator' in sensor ? sensor.simulator : 0);
							
							Sensors[n].type = sensor.type;
							Sensors[n].name = ('name' in sensor && sensor.name != '' ? sensor.name : 'NoName');
							Sensors[n].port = sensor.port;
							Sensors[n].period = ('period' in sensor && sensor.period != '' && !isNaN(sensor.period) ? sensor.period : 1000);
								
							if (Sensors[n].simulator==0) { 							
								Sensors[n].handle = new Gpio(Sensors[n].port, 'out');
							}
							Sensors[n].status = 0;
							break;
							
						case 'PIR':
							Sensors[n] = new Object;
							Sensors[n].simulator = ('simulator' in sensor ? sensor.simulator : 0);
							Sensors[n].type = sensor.type;
							Sensors[n].name = ('name' in sensor && sensor.name != '' ? sensor.name : 'NoName');
							Sensors[n].port = sensor.port;
							Sensors[n].timeCalibration = ('timeCalibration' in sensor && sensor.timeCalibration != '' && !isNaN(sensor.timeCalibration) ? sensor.timeCalibration : 60000);
							Sensors[n].timeRestore = ('timeRestore' in sensor && sensor.timeRestore != '' && !isNaN(sensor.timeRestore) ? sensor.timeRestore : 6000);

							if (Sensors[n].simulator==0) { 							
								Sensors[n].handle = new Gpio(Sensors[n].port, 'in', 'both');
							}
							Sensors[n].status = 0;
							Sensors[n].isAvailable = false;
							break;

						case 'ds1820' :
							Sensors[n] = new Object;
							Sensors[n].simulator = ('simulator' in sensor ? sensor.simulator : 0);
							Sensors[n].type = sensor.type;
							Sensors[n].name = ('name' in sensor && sensor.name != '' ? sensor.name : 'NoName');
							Sensors[n].address = ('address' in sensor && sensor.address != '' ? sensor.address : '00000000');
							Sensors[n].interval = ('interval' in sensor && sensor.interval != '' ? sensor.interval : 1000);
							Sensors[n].bus = ('bus' in sensor && sensor.bus != '' ? sensor.bus :  'w1');
							Sensors[n].file = "/sys/bus/" + sensor.bus + "/devices/" + Sensors[n].address + "/w1_slave";
							break;

						default:
							break;
					}
				}
				n++;
			});	
		}
	}
}

function run() {
// start workcycle	
  	
	Sensors.forEach( sensor => {
		switch(sensor.type) {
			case 'relay':
					// nothing to do 
			break;
			case 'contactor':
				if (sensor.simulator==0) { 						
					// send initial value
					sensor.status = sensor.handle.readSync()
					sendMsg(sensor.name,(sensor.status == 0 ? 'false' : 'true'));
					
					sensor.handle.watch((err,value) => {
						if (err) {
							sendError(sensor.name , err);
						} else {
							sendMsg(sensor.name,(value == 0? 'false' : 'true'));
						}
					});
				} else {
						sendMsg(sensor.name,(sensor.status == 0 ? 'false' : 'true'));
						setInterval(_=> {
							var v = (Math.random() < 0.9 ? 1 : 0);
							if (v != sensor.status) {
								sendMsg(sensor.name,(v == 0 ? 'false' : 'true'));
							}
							sensor.status = v;
						}, 1000);
				}
				break;

			case 'LED_Blink' :
				if (sensor.simulator == 0) {
					sensor.intervalId = setInterval(_ => sensor.handle.writeSync(sensor.handle.readSync() ^ 1), sensor.period);
				}
				break;
			case 'PIR' :
			// Step 1: initial calibration - no any data accepted from sensor
				if (sensor.simulator==0) {
					setTimeout( _ =>{
					//Step 2: watching for motion
						sensor.handle.watch((err, value) => {
						if (err) {
							sendError(sensor.name , err);
						} else {
							if (value == 1) {
								sendMsg(sensor.name, 'Motion Detected!');
										// Sensor require some time to restore. No data received during this period
								setTimeout( _=>{
										// do nothing. Waiting for sensor is restored
								}, sensor.timeRestore );
							} else {
								sendMsg(sensor.name, 'Motion is Off');
							}
						}
					});
				}, sensor.timeCalibration);
				} else { //simulator
						sendMsg(sensor.name,(sensor.status == 0 ? 'Motion is Off' : 'Motion Detected!'));
						setInterval(_=> {
							var v = (Math.random() < 0.9 ? 0 : 1);
							if (v != sensor.status) {
								sendMsg(sensor.name,(sensor.status == 0 ? 'Motion is Off' : 'Motion Detected!'));
							}
							sensor.status = v;
						}, 1000);					
				}
				break;
				
			case 'ds1820' :
				if (sensor.simulator==0) {
					var isFirst = true; // used to display initial temperature
					sensor.intervalId = setInterval(_=>{
						fs.readFile(sensor.file, 'ascii', (err, data) => {
						if (err) {
							sendError(sensor.name , err);
						} else {
							var temp = data.split(" t=")[1];	
							var t = (temp/1000).toFixed(1);
							if (t != sensor.temperature || isFirst) {
								sendMsg(sensor.name, t);
								sensor.temperature = t;
								isFirst = false;
							}
						}
					})},sensor.interval);
				} else {
						sensor.temperature = (Math.random()*45).toFixed(1);
						sendMsg(sensor.name, sensor.temperature);
						setInterval(_=> {
							var v = (Math.random() * 45).toFixed(2);
							if (v != sensor.temperature) {
								sendMsg(sensor.name,v);
							}
							sensor.temperature = v;
						}, 1000);					
				}					
				break;
			default:
				break;
		}
	});
}


