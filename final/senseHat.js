// senseHat
// make the highest water usage to be the maximum value and make other columns relative to the maximum
// in the past 4 hours only, and shift every 30 mins
// each square is 30 mins
// Arduino sends data to pi every 1 sec
// Pi aggregates the 1 sec data to min
// and send data to influxDP database every 1 min
// keep track of time since the last time we made the graph and shift graph accordingly

const { InfluxDB } = require('@influxdata/influxdb-client');
var sense = require('@trbll/sense-hat-led');

// You can generate an API token from the "API Tokens Tab" in the UI
const token = "6RvZoMoeH6FTycblpw8DjA3KIbOdHh1-hj4JJCFQwzTrU2JslzjKDSiOVvCuN0DWF7FhEva5h20OWhKKiw6A_A==";
const org = 'IoTProject'
const bucket = 'FaucetLeakDetector'

const client = new InfluxDB({ url: 'https://us-central1-1.gcp.cloud2.influxdata.com', token: token })
const { Point } = require('@influxdata/influxdb-client');

var volume = 12;
var motion_flag = 0;
var volumes = [0, 0, 0, 0, 0, 0, 0, 0];
var leak = 0;

setInterval(writeData, 60000);

function writeData() {
    const writeApi = client.getWriteApi(org, bucket);
    writeApi.useDefaultTags({ host: 'host1' });

    const vpoint = new Point('data').floatField('volume', volume);
    const gpoint = new Point('data').floatField('motion_flag', motion_flag);
    writeApi.writePoint(vpoint);
    writeApi.writePoint(gpoint);
    writeApi
        .close()
        .then(() => {
        })
        .catch(e => {
            console.error(e);
        });
    volume = 0;
    motion_flag = 0;
}

setInterval(setColumns, 10000);

function setColumns() {
    var i = 0;
    const queryApi = client.getQueryApi(org);
    var query = `from (bucket: "FaucetLeakDetector")
                    |> range(start: -4h)
                    |> filter(fn: (r) => r._measurement == "flow" and r._field == "flow_rate")
                    |> aggregateWindow(every: 30m, fn: sum, createEmpty: false)`;
    queryApi.queryRows(query, {
        next: (row, tableMeta) => {
            const o = tableMeta.toObject(row);
            volumes[i] = o._value;
            i++;
            // console.log(`${o._time} ${o._measurement}: ${o._field}=${o._value}`);
            // console.log(i);
        },
        error: (error) => {
            console.error(error)
        },
        complete: () => {
        },
    });
    // console.log(volumes);

    updateDisplay();
    volumes = [0, 0, 0, 0, 0, 0, 0, 0];
}

function updateDisplay() {
    sense.clear();
    var percent = [0, 0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < volumes.length; i++) {
        percent[i] = volumes[i];
    }
    var max = Math.max(...percent);
    for (var i = 0; i < percent.length; i++) {
        percent[i] = Math.ceil(7 * percent[i] / max);
        for (var j = 0; j < percent[i]; j++) {
            sense.setPixel(i, j + 1, 0, 153, 255); // blue
        }
    }

    if (leak == 1) {
        color(255, 0, 0); // red
    }
    else if (leak == 2) {
        color(255, 255, 0); // yellow
    }
    else {
        color(0, 204, 0); // green
    }
}

function color(r, g, b) {
    for (var i = 0; i < volumes.length; i++) {
        sense.setPixel(i, 0, r, g, b);
    }
}