// senseHat
// make the highest water usage to be the maximum value and make other columns relative to the maximum
// in the past 4 hours only, and shift every 30 mins
// each square is 30 mins
// Arduino sends data to pi every 1 sec
// Pi aggregates the 1 sec data to min
// and send data to influxDP database every 1 min
// keep track of time since the last time we made the graph and shift graph accordingly

const influxDB = require('influx');
const influx = new influxDB.InfluxDB({
    host: 'raspberrypi.local',
    database: 'FaucetLeak',
    schema: [
        {
            measurement: 'data',
            fields: {
                volume: influxDB.FieldType.FLOAT,
                motion_flag: influxDB.FieldType.INTEGER
            },
            tags: []
        }
    ]
})

influx.createDatabase('FaucetLeak');

influx.writePoints([
    {
        measurement: 'data',
        fields: {
            volume: 15.0,
            motion_flag: 0
        }
    }
], {
    database: 'FaucetLeak',
    precision: 's',
})
    .catch(error => {
        console.error(`Error saving data to InfluxDB! ${err.stack}`)
    });

influx.query(`
    select * from data
   `);
