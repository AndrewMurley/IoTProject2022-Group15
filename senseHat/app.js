// run `npm install node-ble` in project folder
const { createBluetooth } = require( 'node-ble' );

// run `npm i @influxdata/influxdb-client` in project folder
const {InfluxDB, Point} = require('@influxdata/influxdb-client');

var sense = require('@trbll/sense-hat-led');

// api key, organization name, and bucket name for InfluxDB
const token = "6RvZoMoeH6FTycblpw8DjA3KIbOdHh1-hj4JJCFQwzTrU2JslzjKDSiOVvCuN0DWF7FhEva5h20OWhKKiw6A_A==";
const org = 'IoTProject';
const bucket = 'FaucetLeakDetector';

// bluetooth address of Arduino
const ARDUINO_BLUETOOTH_ADDR = 'F6:E7:FE:E3:F0:A4';

const UART_SERVICE_UUID      = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const RX_CHARACTERISTIC_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

var prevX = null;
var prevY = null;
var prevZ = null;

var prevFlow = null;

var volume = 0;
var motion_flag = 0;
var volumes = [0, 0, 0, 0, 0, 0, 0, 0];
var leak = 0;

var avg = 300; // seconds

// Initialize InfluxDB client and api for writing to the database
const client = new InfluxDB({url: 'https://us-central1-1.gcp.cloud2.influxdata.com', token: token});
const writeApi = client.getWriteApi(org, bucket);
writeApi.useDefaultTags({host: 'pi'});

// Initialize InfluxDB api for querying the database
const queryApi = client.getQueryApi(org);

async function main( )
{
    // Reference the BLE adapter and begin device discovery...
    const { bluetooth, destroy } = createBluetooth();
    const adapter = await bluetooth.defaultAdapter();
    const discovery =  await adapter.startDiscovery();
    console.log( 'discovering...' );

    // Attempt to connect to the device with specified BT address
    const device = await adapter.waitDevice( ARDUINO_BLUETOOTH_ADDR.toUpperCase() );
    console.log( 'found device. attempting connection...' );
    await device.connect();
    console.log( 'connected to device!' );

    // Get references to the UART service and its characteristics
    const gattServer = await device.gatt();
    const uartService = await gattServer.getPrimaryService( UART_SERVICE_UUID.toLowerCase() );
    const rxChar = await uartService.getCharacteristic( RX_CHARACTERISTIC_UUID.toLowerCase() );

    // Register for notifications on the RX characteristic
    await rxChar.startNotifications( );

    // start repetitively calling setColumns every 10 seconds
    setInterval(setColumns, 10000);

    // start repetitively calling findAvg every 10 minutes
    setInterval(findAvg, 600000);

    // start repetitively calling findLeak every 10 seconds
    setInterval(checkLeak, 1000);

    // Callback for when data is received on RX characteristic
    rxChar.on( 'valuechanged', buffer =>
    {
        const uartDataReceived = buffer.toString();
        var dataList = uartDataReceived.split(" ");

        if (dataList[0] == "[Gyro]") {
            if (dataList.length >= 4) {
                // save the gyroscope data
                var x = dataList[1];
                var y = dataList[2];
                var z = dataList[3];
                console.log("[Gyro] data received: x=" + x + " y=" + y + " z=" + z);
                
                // check if the new values are significantly different from the previously recorded ones
                // gyroscope data is in degrees per second, so more than 7 means the faucet handle was moved while ignoring sensor noise/imprecision
                if ( (Math.abs(x - prevX) >= 7) || (Math.abs(y - prevY) >= 7) || (Math.abs(z - prevZ) >= 7) ) {
                    // check that previous values are not null
                    if ( prevX && prevY && prevZ ) {
                        console.log("Gyroscope data has changed from previous.\n\tOld Data: " + prevX + ", " + prevY + ", " + prevZ + "\n\tNew Data: " + x + ", " + y + ", " + z);
                        
                        // record movement in the database
                        const gpoint = new Point('gyro').floatField('motion_flag', 1);
                        writeApi.writePoint(gpoint);
                        writeApi
                            .flush()
                            .then(() => {
                                console.log('write [gyro] SUCCESS');
                            })
                            .catch(e => {
                                console.error(e);
                                console.log('write [gyro] ERROR');
                            });
                    }

                    // save current values to be new previous values
                    prevX = x;
                    prevY = y;
                    prevZ = z;
                }
            } else {
                console.log("Not enough [Gyro] data received, length of list is too short. Data received: " + uartDataReceived);
            }
        } else if (dataList[0] == "[Flow]") {
            if (dataList.length >= 2) {
                // save the water flow sensor data
                var flowRate = dataList[1];
                console.log("[Flow] data received: flowRate=" + flowRate);
                const vpoint = new Point('flow').floatField('flow_rate', flowRate);
                writeApi.writePoint(vpoint);
                writeApi
                    .flush()
                    .then(() => {
                        console.log('write [flow] SUCCESS');
                    })
                    .catch(e => {
                        console.error(e);
                        console.log('write [flow] ERROR');
                    });
                
                // check if faucet is running and if it was off previously
                if (flowRate != 0){
                    if ( Math.abs(flowRate - prevFlow) > 0 ) {
                        if ( prevFlow == 0 ){
                            console.log("Faucet has been turned on");
                            const status = new Point('flow').floatField('status', 1);
                            writeApi.writePoint(status);
                            writeApi
                                .flush()
                                .then(() => {
                                    console.log('write [status] SUCCESS');
                                })
                                .catch(e => {
                                    console.error(e);
                                    console.log('write [status] ERROR');
                                });
                        }
                        else 
                            console.log("Faucet is running");
                    }
                }
                else if ( flowRate == 0 && prevFlow != 0 && prevFlow !== null) {
                    console.log("Faucet was turned off");
                    const status = new Point('flow').floatField('status', 0);
                    writeApi.writePoint(status);
                    writeApi
                        .flush()
                        .then(() => {
                            console.log('write [status] SUCCESS');
                        })
                        .catch(e => {
                            console.error(e);
                            console.log('write [status] ERROR');
                        });
                }

                // save current flow rate to be new previous flow rate
                prevFlow = flowRate
                
                //TODO: TAKE ACTION ACCORDINGLY (record to DB, analytics, etc.)
                // avg = queryStatus();
                // queryStatus().then((result) => {
                //     console.log(result);
                //     console.log(avg);
                // });
                // console.log(avg);

            } else {
                console.log("Not enough [Flow] data received, length of list is too short. Data received: " + uartDataReceived);
            }
        } else {
            console.log("Received data without a recognizable tag: " + uartDataReceived);
        }
    });
}

main().then((ret) =>
{
    if (ret) console.log( ret );
}).catch((err) =>
{
    if (err) console.error( err );
});

function findAvg(){
    var useCount = `from (bucket: "FaucetLeakDetector") |> range(start: -8h) |> filter(fn: (r) => r._measurement == "flow" and r._field == "status") |> count()`;
    var count = queryApi.queryRows(useCount, {
        next: (row, tableMeta) => {
            const o = tableMeta.toObject(row);
            count = o._value;
        },
        error: (error) => {
            console.error(error);
        },
        complete: () => {
            // console.log(count);
            var sum = 0;
            var useElapsed = `from (bucket: "FaucetLeakDetector") |> range(start: -8h) |> filter(fn: (r) => r._measurement == "flow" and r._field == "status") |> elapsed(unit: 1s)`;
            var query = queryApi.queryRows(useElapsed, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    if ( o._value == 0 ) {
                        // console.log(String(o.elapsed) + " e");
                        sum = sum + o.elapsed;
                    }
                },
                error: (error) => {
                    console.error(error);
                },
                complete: () => {
                    if ( count % 2 != 0 )
                        avg = sum / ( ( count - 1 ) / 2 );
                    else
                        avg = sum / ( count / 2 );
                    // console.log(avg);
                }
            })
        },
    });
}

function checkLeak() {
    // if water is flowing, get timestamp of when gyro was moved (get most recent value in gyro db)
    var flowing = null;
    var flowStamp = null;
    var checkFlow = `from (bucket: "FaucetLeakDetector") |> range(start: -8h) |> filter(fn: (r) => r._measurement == "flow" and r._field == "status")`;
    queryApi.queryRows(checkFlow, {
        next: (row, tableMeta) => {
            console.log("reached");
            const o = tableMeta.toObject(row);
            flowing = o._value;
            // flowStamp = o._time;
            console.log(o._time);
        },
        error: (error) => {
            console.error(error);
        },
        complete: () => {
            moved = `from (bucket: "FaucetLeakDetector") |> range(start: -8h) |> filter(fn: (r) => r._measurement == "gyro" and r._field == "motion_flag")`;
            if ( flowing == 1 ) {
                queryApi.queryRows(moved, {
                    next: (row, tableMeta) => {
                        const o = tableMeta.toObject(row);
                        console.log( o._time );
                    },
                    error: (error) => {
                        console.error(error);
                    },
                    complete: () => {
                    }
                });
            }
        }
    });
    // compare time elapsed from last movement of gyro to avg
    // if time elapsed is greater than 2 * avg, change leds to red
    // if time elapsed is greater than 1.5 * avg and less than 2 * avg, change leds to orange
    // if time elapsed is greater than avg and less than 1.5 * avg, change leds to yellow
    // otherwise, change leds to green

    // possible improvement, add flag to flow database for if leak is true so that leaks are not included in the avg
}

// function queryStatus() {
//     // query database to see if there are at least five previous water flow sessions
//     var count = null;
//     var statusCount = `from (bucket: "FaucetLeakDetector") |> range(start: -8h) |> filter(fn: (r) => r._measurement == "flow" and r._field == "status") |> count()`;
//     var temp = queryApi.queryRows(statusCount, {
//         next: (row, tableMeta) => {
//             const o = tableMeta.toObject(row);
//             // console.log(`${o._time} ${o._measurement}: ${o._field}=${o._value}`);
//             // console.log(`${o._value}`);
//             count = o._value;
//             if ( count >= 0 ) {
//                 // var time = now();
//                 var statusCount = `from (bucket: "FaucetLeakDetector") |> range(start: -8h) |> filter(fn: (r) => r._measurement == "flow" and r._field == "status") |> elapsed(unit: 1s)`;
//                 var times = [];
        
//                 temp = queryApi.queryRows(statusCount, {
//                     next: (row, tableMeta) => {
//                         const o = tableMeta.toObject(row);
//                         // console.log(`${o._time} ${o._measurement}: ${o._field}=${o._value}`);
//                         if ( o._value == 0 ) {
//                             times.push(o.elapsed);
//                         }
//                     },
//                     error: (error) => {
//                         console.error(error)
//                     },
//                     complete: () => {
//                         sum = times.reduce((a, b) => a + b, 0);
//                         return sum / times.length;
//                     },
//                 });
//             }
//         },
//         error: (error) => {
//             console.error(error);
//         },
//         complete: () => {
//             return temp;
//         },
//     });

//     return temp;
// }


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

function setColumns() {
    var i = 7;
    var query = `from (bucket: "FaucetLeakDetector")
                    |> range(start: -4h)
                    |> filter(fn: (r) => r._measurement == "flow" and r._field == "flow_rate")
                    |> aggregateWindow(every: 30m, fn: sum, createEmpty: true)
                    |> sort(columns: ["_time"], desc: false)`;
    queryApi.queryRows(query, {
        next: (row, tableMeta) => {
            const o = tableMeta.toObject(row);
            if (i >= 0) {
                volumes[i] = o._value;
            }
            i--;
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
}
