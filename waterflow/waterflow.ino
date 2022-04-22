// IoT Project -- Faucet Leak Detector -- Group 15

int X;
int Y;
float TIME = 0;
float FREQUENCY = 0;
float WATER = 0;
float TOTAL = 0;
float LS = 0;
const int input = A0;

void setup() {
  Serial.begin(9600);
  pinMode(input,INPUT);
}

void loop() {
  X = pulseIn(input, HIGH);
  Y = pulseIn(input, LOW);
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
    }
    else
    {
      TOTAL = TOTAL + LS;
      Serial.println(FREQUENCY);
      Serial.println("Vol: "+String(WATER)+" L/M");
      Serial.println("Total: "+String(TOTAL)+" L");
    }
  }
  delay(1000);
}
