const { Bme680 } = require('bme680-sensor');
const bme680 = new Bme680(1, 0x76);
const Influx = require('influx'); 
const IAQ = require('iaq');
const fetch = require('fetch');

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
		let now = new Date();
		currentTime = now.getTime();
		console.log("CUR",currentTime)
		burnInData.push(gas_resistance)
		if(burnInData.length > 50){
			burnInData.shift();
		}
		console.log(burnInData, burnInData.length)

	}


	let gas_baseline = burnInData.reduce(function(a, b){
        	return a + b;
    	}, 0);

	let gas_low = Math.min(...burnInData);
	let gas_high = Math.max(...burnInData);

	let iaq = new IAQ(gas_resistance, humidity, 40, gas_low, gas_high)

	iaq = iaq.values();

	let readOut = {
		temperature: temperature,
		pressure: pressure,
		humidity: humidity,
		iaq: iaq.iaqScore,
		date: date
	}
	console.log(readOut)

	influx.writePoints([
		{
		     measurement: 'enviroment',
		     tags: { room: 'Office'},
		     fields: readOut   } ])

	 fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': printer.apikey
            },
            body: JSON.stringify(readOut)
        });
	
	
	
        
    },  5000);
});
