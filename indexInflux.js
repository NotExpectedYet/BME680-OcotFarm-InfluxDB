const { Bme680 } = require('bme680-sensor');
const bme680 = new Bme680(1, 0x76);
const Influx = require('influx');

let startTime = new Date();
startTime = startTime.getTime();
let currentTimeTime = new Date();
currentTime = currentTimeTime.getTime();

const burnInTime = 1200000;
let burnInData = [];
const interval = 1000;
const room = "Office";
const measurement = "enviroment"
const databaseName = 'house_enviroment_db';
const host = '192.168.1.5';
const port = 8086;
const sendToInflux = true;
const sendToOctoFarm = false;
const octoFarmURL = "http://192.168.1.5:4000/input/roomData"





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

	
	//Collect a baseline reading
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
	let gas_sum = burnInData.reduce(function(a, b){
		return a + b;
	}, 0);


	// Calculate the gas resistance baseline
	const gasResistanceBaseline = gas_sum / burnInData.length;

	// Define the humidity baseline nd humidity weighting.
	const humidityBaseline = 40, // 40%RH is an optimal indoor humidity
		humidityWeighting = 25; // use a balance between humidity and gas resistance of 25%:75%


	let IAQ = null;
	let airQuality = null;
	// Indefinitely calculate the air quality at the set interval.

	// Measure the gas resistance and calculate the offset.
	const gasResistance = gas_resistance,
		gasResistanceOffset = gasResistanceBaseline - gasResistance;

	// Calculate the gas resistance score as the distance from the gas resistance baseline.
	let gasResistanceScore = 0;
	if (gasResistanceOffset > 0) {
		gasResistanceScore = (gasResistance / gasResistanceBaseline) * (100 - humidityWeighting);
	} else {
		gasResistanceScore = 100 - humidityWeighting;
	}

	// Measure the humidity and calculate the offset.
	humidity = humidity,
		humidityOffset = humidity - humidityBaseline;

	// Calculate the humidity score as the distance from the humidity baseline.
	let humidityScore = 0;
	if (humidityOffset > 0) {
		humidityScore = (100 - humidityBaseline - humidityOffset) / (100 - humidityBaseline) * humidityWeighting;
	} else {
		humidityScore = (humidityBaseline + humidityOffset) / humidityBaseline * humidityWeighting;
	}

	// Calculate the air quality.
	airQuality = gasResistanceScore + humidityScore;
	console.log(`Air quality (%): ${airQuality}`);
	IAQ = Math.round((100 - airQuality) * 5);
	console.log("ACCURACY", burnInTime - (currentTime - startTime));




		if(sendToInflux){
			const influx = new Influx.InfluxDB({host: host, database: databaseName, port:port});

			let readOut = {
				temperature: temperature,
				pressure: pressure,
				humidity: humidity,
				iaq: IAQ,
				airQuality: airQuality,
				date: date
			}
			console.log(readOut)
			influx.writePoints([
				{
					measurement: measurement,
					tags: { room: room},
					fields: readOut   } ])
		}
		if(sendToOctoFarm){
			let readOut = {
				temperature: temperature,
				pressure: pressure,
				humidity: humidity,
				iaq: IAQ,
				date: date
			}
			fetch(octoFarmURL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(readOut)
			});
		}


    },  interval);
});
