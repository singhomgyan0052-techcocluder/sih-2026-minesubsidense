#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <WiFi.h>
#include <PubSubClient.h>

// -------------------------------------------------------------
// WIFI & MQTT CONFIGURATION
// -------------------------------------------------------------
const char* ssid = "POCO X7";        // Apna WiFi naam daalein
const char* password = "12345678"; // Apna WiFi password daalein

const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;

// Topic & ID - Backend "subsidence/telemetry/#" par sun raha hai
const char* topic = "subsidence/telemetry/NODE-001";
const char* node_id = "NODE-001";

WiFiClient espClient;
PubSubClient client(espClient);
// -------------------------------------------------------------

// SW-420 vibration switch
const int SW420_PIN = 32;

// HW-072 NTC thermistor temperature module
const int TEMP_SENSOR_PIN = 36;
const float TEMP_SERIES_RESISTOR = 10000.0;
const float TEMP_NOMINAL_RESISTANCE = 10000.0;
const float TEMP_NOMINAL_C = 25.0;
const float TEMP_BETA = 3950.0;

// Local alert hardware
const int LED_GREEN_PIN = 25;
const int LED_YELLOW_PIN = 26;
const int LED_RED_PIN = 27;
const int BUZZER_PIN = 33;
const int BATTERY_PIN = 34;

// Thresholds
const float DRIFT_WARNING_MM_PER_M = 2.0; 
const float TILT_WARNING_MM_PER_M = 5.0; 
const float TILT_CRITICAL_MM_PER_M = 10.0; 
const float TEMP_DRIFT_COEFF_MM_PER_M_PER_C = 0.02;

const unsigned long SAMPLE_INTERVAL_MS = 200;
const unsigned long PRINT_INTERVAL_MS = 1000;
const int CALIBRATION_SAMPLES = 150;

Adafruit_MPU6050 mpu;
float baselineTiltXDeg = 0;
float baselineTiltYDeg = 0;
float calibrationTempC = 25.0;

String lastStatus = "safe";

unsigned long lastSample = 0;
unsigned long lastPrint = 0;

// --- WIFI & MQTT FUNCTIONS ---
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("Connected to MQTT Broker!");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// --- SENSOR FUNCTIONS ---
float computeTiltDegrees(float ax, float ay, float az) {
  return atan2(ax, sqrt(ay * ay + az * az)) * 180.0 / PI;
}

float degreesToMmPerM(float degrees) {
  return tan(degrees * PI / 180.0) * 1000.0;
}

float readTemperatureC() {
  int raw = analogRead(TEMP_SENSOR_PIN);
  if (raw <= 0) raw = 1;
  float resistance = TEMP_SERIES_RESISTOR * (4095.0 / raw - 1.0);
  float steinhart = resistance / TEMP_NOMINAL_RESISTANCE;
  steinhart = log(steinhart);
  steinhart /= TEMP_BETA;
  steinhart += 1.0 / (TEMP_NOMINAL_C + 273.15);
  steinhart = 1.0 / steinhart;
  steinhart -= 273.15;
  return steinhart;
}

float readBatteryPercent() {
  int raw = analogRead(BATTERY_PIN);
  float voltage = (raw / 4095.0) * 3.3 * 2.0;
  float percent = (voltage - 3.3) / (4.2 - 3.3) * 100.0;
  return constrain(percent, 0, 100);
}

bool readVibrationSwitch() {
  return digitalRead(SW420_PIN) == HIGH;
}

void calibrateMpu() {
  Serial.println("Calibrating... keep the node still for about 30 seconds.");
  double sumX = 0, sumY = 0, sumTemp = 0;
  for (int i = 0; i < CALIBRATION_SAMPLES; i++) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    sumX += computeTiltDegrees(a.acceleration.x, a.acceleration.y, a.acceleration.z);
    sumY += computeTiltDegrees(a.acceleration.y, a.acceleration.x, a.acceleration.z);
    sumTemp += readTemperatureC();
    delay(SAMPLE_INTERVAL_MS);
  }
  baselineTiltXDeg = sumX / CALIBRATION_SAMPLES;
  baselineTiltYDeg = sumY / CALIBRATION_SAMPLES;
  calibrationTempC = sumTemp / CALIBRATION_SAMPLES;
  Serial.println("Calibration done. Baseline X=" + String(baselineTiltXDeg, 3) + " Y=" + String(baselineTiltYDeg, 3) + " tempRef=" + String(calibrationTempC, 1) + "C");
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  
  if (!mpu.begin()) {
    Serial.println("MPU6050 not found. Check wiring.");
    while (1) delay(10);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_YELLOW_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(SW420_PIN, INPUT);
  
  digitalWrite(LED_GREEN_PIN, HIGH);
  
  // Connect WiFi and MQTT
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setBufferSize(512); // IMPORTANT: Increase buffer size to fit the JSON payload

  calibrateMpu();
  Serial.println("Node ready. Printing and Publishing readings every second.\n");
}

void updateLocalAlerts(float tiltXmmM, float tiltYmmM, bool vibrationTriggered) {
  float worstTilt = max(abs(tiltXmmM), abs(tiltYmmM));
  // Disabling vibrationTriggered from forcing a CRITICAL alert to stop the annoying false alarms
  bool critical = (worstTilt >= TILT_CRITICAL_MM_PER_M);
  bool warning = (!critical) && (worstTilt >= TILT_WARNING_MM_PER_M);
  bool drifting = (!critical) && (!warning) && (worstTilt >= DRIFT_WARNING_MM_PER_M);

  digitalWrite(LED_GREEN_PIN, !critical && !warning);
  digitalWrite(LED_YELLOW_PIN, warning || drifting);
  digitalWrite(LED_RED_PIN, critical);
  
  digitalWrite(BUZZER_PIN, warning || critical);

  if (critical) lastStatus = "CRITICAL";
  else if (warning) lastStatus = "WARNING";
  else if (drifting) lastStatus = "DRIFT";
  else lastStatus = "SAFE";
}

void loop() {
  // Ensure MQTT connection
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  static float tiltXmmM = 0, tiltYmmM = 0, vibration = 0, temperatureC = 0, battery = 0;
  static bool vibrationTriggered = false;

  if (now - lastSample >= SAMPLE_INTERVAL_MS) {
    lastSample = now;
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    float rawTiltXDeg = computeTiltDegrees(a.acceleration.x, a.acceleration.y, a.acceleration.z);
    float rawTiltYDeg = computeTiltDegrees(a.acceleration.y, a.acceleration.x, a.acceleration.z);

    temperatureC = readTemperatureC();
    float tempDeltaC = temperatureC - calibrationTempC;
    float tempCorrectionMmM = tempDeltaC * TEMP_DRIFT_COEFF_MM_PER_M_PER_C;

    float deltaTiltXDeg = rawTiltXDeg - baselineTiltXDeg;
    float deltaTiltYDeg = rawTiltYDeg - baselineTiltYDeg;

    tiltXmmM = degreesToMmPerM(deltaTiltXDeg) - tempCorrectionMmM;
    tiltYmmM = degreesToMmPerM(deltaTiltYDeg) - tempCorrectionMmM;
    vibration = sqrt(g.gyro.x * g.gyro.x + g.gyro.y * g.gyro.y + g.gyro.z * g.gyro.z);
    
    vibrationTriggered = readVibrationSwitch();
    battery = readBatteryPercent();

    updateLocalAlerts(tiltXmmM, tiltYmmM, vibrationTriggered);
  }

  // Publish to Cloud exactly every second
  if (now - lastPrint >= PRINT_INTERVAL_MS) {
    lastPrint = now;

    // Local Serial Logging
    Serial.print("Status: "); Serial.print(lastStatus);
    Serial.print(" | Tilt X: "); Serial.print(tiltXmmM, 2);
    Serial.print(" mm/m | Tilt Y: "); Serial.print(tiltYmmM, 2);
    Serial.print(" mm/m | Vibration: "); Serial.print(vibration, 2);
    Serial.print(vibrationTriggered ? " (SW420 TRIGGERED)" : "");
    Serial.print(" | Temp: "); Serial.print(temperatureC, 1);
    Serial.print(" C | Battery: "); Serial.print((int)battery);
    Serial.println("%");

    // MQTT Payload formatting
    float resultant = sqrt((tiltXmmM * tiltXmmM) + (tiltYmmM * tiltYmmM));
    
    String payload = "{";
    payload += "\"id\":\"" + String(node_id) + "\",";
    payload += "\"tilt_x_mm_per_m\":" + String(tiltXmmM, 1) + ",";
    payload += "\"tilt_y_mm_per_m\":" + String(tiltYmmM, 1) + ",";
    payload += "\"tilt_resultant_mm_per_m\":" + String(resultant, 1) + ",";
    payload += "\"status\":\"" + lastStatus + "\"";
    payload += "}";

    // Publish to Broker
    bool success = client.publish(topic, payload.c_str());
    if (success) {
      Serial.println("MQTT Publish OK");
    } else {
      Serial.println("MQTT Publish FAILED! (Buffer size issue or disconnected)");
    }
  }
}
