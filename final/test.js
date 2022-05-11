// run `npm install node-ble` in project folder
const { createBluetooth } = require( 'node-ble' );

// run `npm i @influxdata/influxdb-client` in project folder
const {InfluxDB} = require('@influxdata/influxdb-client');

// api key, organization name, and bucket name for InfluxDB
const token = "6RvZoMoeH6FTycblpw8DjA3KIbOdHh1-hj4JJCFQwzTrU2JslzjKDSiOVvCuN0DWF7FhEva5h20OWhKKiw6A_A==";
const org = 'IoTProject';
const bucket = 'FaucetLeakDetector';

// bluetooth address of Arduino
const ARDUINO_BLUETOOTH_ADDR = 'F6:E7:FE:E3:F0:A4';

// Initialize InfluxDB client and api for writing to the database
const client = new InfluxDB({url: 'https://us-central1-1.gcp.cloud2.influxdata.com', token: token});
const writeApi = client.getWriteApi(org, bucket);
writeApi.useDefaultTags({host: 'pi'});

async function main( )
{
    // Reference the BLE adapter and begin device discovery...
    const { bluetooth, destroy } = createBluetooth();
    const adapter = await bluetooth.defaultAdapter();
    if (!await adapter.isDiscovering())
    {
        await adapter.startDiscovery();
    }
        
    // const discovery =  await adapter.startDiscovery();
    console.log( 'discovering...' );

    // Attempt to connect to the device with specified BT address
    const device = await adapter.waitDevice( ARDUINO_BLUETOOTH_ADDR.toUpperCase() );
    console.log( 'found device. attempting connection...' );
    if (!await device.isConnected()){
        await device.connect();
    }
    console.log( 'connected to device!' );

    console.log( 'disconnecting...' );
    await device.disconnect();
    console.log( 'disconnected.' );
    destroy();
}

main().then((ret) =>
{
    if (ret) console.log( ret );
}).catch((err) =>
{
    if (err) console.error( err );
});
