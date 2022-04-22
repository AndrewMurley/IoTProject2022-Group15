// run `npm install node-ble` in project folder
const { createBluetooth } = require( 'node-ble' );

// bluetooth address of Arduino
const ARDUINO_BLUETOOTH_ADDR = 'F6:E7:FE:E3:F0:A4';

const UART_SERVICE_UUID      = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
// const TX_CHARACTERISTIC_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';
const RX_CHARACTERISTIC_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

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
    // const txChar = await uartService.getCharacteristic( TX_CHARACTERISTIC_UUID.toLowerCase() );
    const rxChar = await uartService.getCharacteristic( RX_CHARACTERISTIC_UUID.toLowerCase() );

    // Register for notifications on the RX characteristic
    await rxChar.startNotifications( );

    // Callback for when data is received on RX characteristic
    rxChar.on( 'valuechanged', buffer =>
    {
        const uartDataReceived = buffer.toString();
        var dataList = uartDataReceived.split(" ");

        if (dataList[0] == "[Gyro]") {
            if (dataList.length >= 4) {
                var x = dataList[1];
                var y = dataList[2];
                var z = dataList[3];
                console.log("[Gyro] data received: x=" + x + " y=" + y + " z=" + z);
                //TODO: TAKE ACTION ACCORDINGLY (record to DB, analytics, etc.)
            } else {
                console.log("Not enough [Gyro] data received, length of list is too short. Data received: " + uartDataReceived);
            }
        } else if (dataList[0] == "[Flow]") {
            if (dataList.length >= 2) {
                var flowRate = dataList[1];
                console.log("[Flow] data received: flowRate=" + flowRate);
                //TODO: TAKE ACTION ACCORDINGLY (record to DB, analytics, etc.)
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
