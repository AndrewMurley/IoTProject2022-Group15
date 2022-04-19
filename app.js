// run `npm install node-ble` in project folder
const { createBluetooth } = require("node-ble");

//TODO: update bluetooth address of Arduino
const ARDUINO_BLUETOOTH_ADDR = "08:70:6F:56:D8:92";

const UART_SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
// const TX_CHARACTERISTIC_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';
const RX_CHARACTERISTIC_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";

async function main() {
  // Reference the BLE adapter and begin device discovery...
  const { bluetooth, destroy } = createBluetooth();
  const adapter = await bluetooth.defaultAdapter();
  const discovery = await adapter.startDiscovery();
  console.log("discovering...");

  // Attempt to connect to the device with specified BT address
  const device = await adapter.waitDevice(ARDUINO_BLUETOOTH_ADDR.toUpperCase());
  console.log("found device. attempting connection...");
  await device.connect();
  console.log("connected to device!");

  // Get references to the UART service and its characteristics
  const gattServer = await device.gatt();
  const uartService = await gattServer.getPrimaryService(
    UART_SERVICE_UUID.toLowerCase()
  );
  // const txChar = await uartService.getCharacteristic( TX_CHARACTERISTIC_UUID.toLowerCase() );
  const rxChar = await uartService.getCharacteristic(
    RX_CHARACTERISTIC_UUID.toLowerCase()
  );

  // Register for notifications on the RX characteristic
  await rxChar.startNotifications();

  // Callback for when data is received on RX characteristic
  rxChar.on("valuechanged", (buffer) => {
    //TODO: PARSE DATA RECEIVED AND TAKE ACTION ACCORDINGLY (record to DB, analytics, etc.)
    console.log("Received: " + buffer.toString());
  });
}

main()
  .then((ret) => {
    if (ret) console.log(ret);
  })
  .catch((err) => {
    if (err) console.error(err);
  });
