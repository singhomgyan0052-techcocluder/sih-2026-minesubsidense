#include <SPI.h>
#include <LoRa.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

Adafruit_MPU6050 mpu;

// --- Node Details ---
const String NODE_ID = "NODE_001";
const String GATEWAY_ID = "GW_001";

// --- Pins ---
const int BATTERY_PIN = 34; // Analog pin for battery voltage divider
const int VIBRATION_PIN = 35; // Analog pin for vibration sensor

void setup() {
  Serial.begin(115200);
  while (!Serial);

  Serial.println("Initializing LoRa Node...");

  // Setup LoRa (Change pins based on your ESP32 board)
  LoRa.setPins(5, 14, 2); // NSS, RST, DIO0
  if (!LoRa.begin(433E6)) { // 433 MHz or 868 MHz depending on region
    Serial.println("Starting LoRa failed!");
    while (1);
  }
  
  // Setup MPU6050
  if (!mpu.begin()) {
    Serial.println("Failed to find MPU6050 chip");
    while (1);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
}

void loop() {
  // 1. Read MPU6050 (Tilt)
  sensors_event_t a, g, temp_event;
  mpu.getEvent(&a, &g, &temp_event);
  
  // Simple conversion from acceleration to tilt (mm per meter)
  float tilt_x = a.acceleration.x * 100.0; 
  float tilt_y = a.acceleration.y * 100.0;
  
  // 2. Read Vibration
  int vib_raw = analogRead(VIBRATION_PIN);
  float vibration = vib_raw / 4095.0; // Normalized to 0-1G for demo

  // 3. Read Battery (Assuming voltage divider)
  int bat_raw = analogRead(BATTERY_PIN);
  float battery_pct = map(bat_raw, 0, 4095, 0, 100);

  // 4. Create JSON Payload
  StaticJsonDocument<256> doc;
  doc["node_id"] = NODE_ID;
  doc["gateway_id"] = GATEWAY_ID;
  doc["temp_c"] = temp_event.temperature;
  doc["tilt_x_raw_mm_per_m"] = tilt_x;
  doc["tilt_y_raw_mm_per_m"] = tilt_y;
  doc["vibration_rms_g"] = vibration;
  doc["battery_pct"] = battery_pct;
  doc["crack_mm"] = 0; // If you add an extensometer later

  String payload;
  serializeJson(doc, payload);

  // 5. Send via LoRa Mesh
  Serial.println("Sending packet: " + payload);
  LoRa.beginPacket();
  LoRa.print(payload);
  LoRa.endPacket();

  // Wait 10 seconds before next reading
  delay(10000);
}
