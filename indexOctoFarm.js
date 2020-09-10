const { Bme680 } = require('bme680-sensor');
const bme680 = new Bme680(1, 0x76);
const fetch = require('node-fetch');
const Influx = require('influx'); 

let startTime = new Date();
startTime = startTime.getTime();
let currentTimeTime = new Date();
currentTime = currentTimeTime.getTime();

let burnInTime = 1200000;
let burnInData = [];

let databaseName = 'house_enviroment_db';

const influx = new Influx.InfluxDB({host: '192.168.1.5', database: databaseName, port:8086});

influx.getDatabaseNames().then(names=>{if(!names.include(databaseName)){return influx.createDatabase(databaseName);}});



bme680.initialize().then(async () => {
    console.info('Sensor initialized');
    setInterval(async () => {

	let bme680Data = await bme680.getSensorData();
//	console.log(bme680Data)
	let temperature = bme680Data.data.temperature;
//	console.log(temperature)
	let pressure = bme680Data.data.pressure;
	let humidity = bme680Data.data.humidity;
	let gas_resistance = bme680Data.data.gas_resistance;
	let date = Date.now();

	

	if((currentTime - startTime) < burnInTime){
	console.log("Collecting gas resistance burn in data for 20 minutes: "+` Start: ${startTime} / Current: ${currentTime} / Remain: ${(currentTime - startTime) - burnInTime}`)
	console.log(currentTime,startTime)
		let now = new Date();
		currentTime = now.getTime();
		console.log("CUR",currentTime)
		burnInData.push(gas_resistance)
	}

	console.log(burnInData)

	let gas_baseline = burnInData.reduce(function(a, b){
        	return a + b;
    	}, 0);
	gas_baseline = gas_baseline / burnInData.length;

	let hum_baseline = 40.0;
	let hum_weighting = 0.25;

	let gas = gas_resistance;
	let gas_offset = gas_baseline - gas;
	let gas_score = null;

	let hum = humidity;
	let hum_offset = hum - hum_baseline;
	let hum_score = null;

	console.log(gas_offset, hum_offset)

	if(hum_offset > 0){
		hum_score = ((hum_baseline - hum_offset) - 100);
		hum_score /= (hum_baseline - 100);
		hum_score *= (hum_weighting * 100);
	}else{
		hum_score = (hum_baseline + hum_offset)
		hum_score /= hum_baseline;
		hum_score *= (hum_weighting * 100)
	}

	if(gas_offset > 0){
		gas_score = (gas / gas_baseline)
		gas_score *= (100 - (hum_weighting * 100))
	}else{
		gas_score = 100 - (hum_weighting * 100)
	}


	let iaq = hum_score + gas_score;
	let readOut = {
		temperature: temperature,
		pressure: pressure,
		humidity: humidity,
		iaq: iaq,
		date: date
	}
	console.log(readOut)

	influx.writePoints([
		{
		     measurement: 'enviroment',
		     tags: { room: 'PrinterRoom'},
		     fields: readOut   } ])

	fetch('http://192.168.1.5:4000/input/roomData', {
 		 method: 'POST', // or 'PUT'
  		headers: {
    		'Content-Type': 'application/json',
  		},
  		body: JSON.stringify(readOut),
	}).then(e => {
		console.log(e)
	}).catch(e => {
		console.error(e)
	})
	
	
	
        
    },  5000);
});