#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#define BUFSIZE 20

/*   We'll use the ArduinoBLE library to simulate a basic UART connection 
 *   following this UART service specification by Nordic Semiconductors. 
 *   More: https://learn.adafruit.com/introducing-adafruit-ble-bluetooth-low-energy-friend/uart-service
 */
BLEService uartService("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
BLEStringCharacteristic txChar("6E400002-B5A3-F393-E0A9-E50E24DCCA9E", BLEWrite, 20 );
BLEStringCharacteristic rxChar("6E400003-B5A3-F393-E0A9-E50E24DCCA9E", BLERead | BLENotify, 20 );

void setup() {
  // put your setup code here, to run once:
  Serial.begin(9600);
  while (!Serial);
  Serial.println("Started");

  if ( !BLE.begin() )
  {
    Serial.println("Starting BLE failed!");
    while(1);
  }
  if (!IMU.begin()) {
    Serial.println("Failed to initialize IMU!");
    while (1);
  }

  // Get the Arduino's BT address
  String deviceAddress = BLE.address();

  // The device name we'll advertise with.
  BLE.setLocalName("IoTProject15");

  // Get UART service ready.
  BLE.setAdvertisedService( uartService );
  uartService.addCharacteristic( txChar );
  uartService.addCharacteristic( rxChar );
  BLE.addService( uartService );

  Serial.print("Gyroscope sample rate = ");
  Serial.print(IMU.gyroscopeSampleRate());
  Serial.println(" Hz");
  Serial.println();
  Serial.println("Gyroscope in degrees/second");
  Serial.println("X\tY\tZ");

  // Start advertising our new service.
  BLE.advertise();
  Serial.println("Bluetooth device (" + deviceAddress + ") active, waiting for connections...");
}

void loop() {
  // put your main code here, to run repeatedly:
  // Wait for a BLE central device.
  BLEDevice central = BLE.central();

  // If a central device is connected to the peripheral...
  if ( central )
  {
    // Print the central's BT address.
    Serial.print("Connected to central: ");
    Serial.println( central.address() );

    // While the central device is connected...
    while( central.connected() )
    {
      // Get input from user, send to central
      float x, y, z;
      
      if (IMU.gyroscopeAvailable()) {
        IMU.readGyroscope(x, y, z);
      }
      
      Serial.print("[Gyro] ");
      Serial.print( x );
      Serial.print( " " );
      Serial.print( y );
      Serial.print( " " );
      Serial.println( z );
      
      delay(1000);
    }
    
    Serial.print("Disconnected from central: ");
    Serial.println( central.address() );
  }
}
