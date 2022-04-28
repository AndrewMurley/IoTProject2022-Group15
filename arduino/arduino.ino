#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#define BUFSIZE 20

/*   We'll use the ArduinoBLE library to simulate a basic UART connection 
 *   following this UART service specification by Nordic Semiconductors. 
 *   More: https://learn.adafruit.com/introducing-adafruit-ble-bluetooth-low-energy-friend/uart-service
 */
BLEService uartService("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
BLEStringCharacteristic txChar("6E400002-B5A3-F393-E0A9-E50E24DCCA9E", BLEWrite, 20 );
BLEStringCharacteristic rxChar("6E400003-B5A3-F393-E0A9-E50E24DCCA9E", BLERead | BLENotify, 40 );

unsigned long X;
unsigned long Y;
float TIME = 0;
float FREQUENCY = 0;
float WATER = 0;
float TOTAL = 0;
float LS = 0;
const int input = A0;

const int timeout = 1000;
unsigned long previousMicros;

static uint32_t newPulseIn(uint32_t pin, uint32_t state, uint32_t timeout = 300000L){
  uint32_t begin = micros();
  
  // wait for any previous pulse to end
  while (digitalRead(pin)){
    delayMicroseconds(1);
    if (micros() - begin >= timeout)
    return 0;
  }
  
  // wait for the pulse to start
  while (!digitalRead(pin)){
    delayMicroseconds(1);
    if (micros() - begin >= timeout)
    return 0;
  }
  uint32_t pulseBegin = micros();
  
  // wait for the pulse to stop
  while (digitalRead(pin)){
    delayMicroseconds(1);
    if (micros() - begin >= timeout)
    return 0;
  }
  uint32_t pulseEnd = micros();
  
  return pulseEnd - pulseBegin;
}

void setup() {
  // put your setup code here, to run once:
  Serial.begin(9600);
  while (!Serial);
  Serial.println("Started");

  pinMode(input,INPUT);

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
      // Gyroscope
      float x, y, z;
      
      if (IMU.gyroscopeAvailable()) {
        IMU.readGyroscope(x, y, z);
      }

      String gyro_output = "[Gyro] " + String(x) + " " + String(y) + " " + String(z);
      Serial.println( gyro_output );
      rxChar.writeValue( gyro_output );

      // Water Flow Sensor
//      X = pulseIn(input, HIGH);
//      Y = pulseIn(input, LOW);
//      previousMicros = micros();
//      while(!digitalRead(input) && (micros() - previousMicros) <= timeout);
//      previousMicros = micros();
//      while(digitalRead(input) && (micros() - previousMicros) <= timeout);
//      X = micros() - previousMicros;
//
//      previousMicros = micros();
//      while(digitalRead(input)  && (micros() - previousMicros) <= timeout);
//      previousMicros = micros();
//      while(!digitalRead(input) && (micros() - previousMicros) <= timeout);
//      Y = micros() - previousMicros;
      X = newPulseIn(input, HIGH);
      Y = newPulseIn(input, LOW);
      
      TIME = X + Y;
      FREQUENCY = 1000000/TIME;
      WATER = FREQUENCY/5.5;
      LS = WATER/60;
      
      if(FREQUENCY >= 0)
      {
        if(isinf(FREQUENCY))
        {
          Serial.println("Vol: 0 L/M");
          Serial.println("Total: 0 L");
          rxChar.writeValue("[Flow] 0");
        }
        else
        {
          TOTAL = TOTAL + LS;
          Serial.println(FREQUENCY);
          Serial.println("Vol: "+String(WATER)+" L/M");
          Serial.println("Total: "+String(TOTAL)+" L");
          rxChar.writeValue("[Flow] " + String(LS) );
        }
      }
      previousMicros = micros();
      while((micros() - previousMicros) <= 1000000);
    }
    
    Serial.print("Disconnected from central: ");
    Serial.println( central.address() );
  }
}
