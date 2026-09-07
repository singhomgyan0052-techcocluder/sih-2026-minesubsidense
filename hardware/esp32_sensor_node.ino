#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// --- WiFi Credentials ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// --- MQTT Broker Settings ---
const char* mqtt_server = "test.mosquitto.org";
const int mqtt_port = 1883;

// --- Node Details ---
const char* NODE_ID = "NODE_12345"; // Replace with your Node ID from the dashboard
const char* GATEWAY_ID = "GW_001"; // Replace with your Gateway ID

WiFiClient espClient;
PubSubClient client(espClient);

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Simulate reading sensors (Replace these with real sensor reading code)
  float temp = 25.0 + random(-20, 20) / 10.0;
  float tilt_x = random(-50, 50) / 10.0;
  float tilt_y = random(-50, 50) / 10.0;
  float vibration = random(0, 100) / 100.0;
  float crack = random(0, 50) / 10.0;
  float battery = random(60, 100);

  // Create JSON payload
  StaticJsonDocument<512> doc;
  doc["node_id"] = NODE_ID;
  doc["gateway_id"] = GATEWAY_ID;
  doc["temp_c"] = temp;
  doc["tilt_x_raw_mm_per_m"] = tilt_x;
  doc["tilt_y_raw_mm_per_m"] = tilt_y;
  doc["vibration_rms_g"] = vibration;
  doc["crack_mm"] = crack;
  doc["battery_pct"] = battery;

  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);

  // Publish to the specific node's topic
  String topic = String("subsidence/telemetry/") + NODE_ID;
  
  Serial.print("Publishing to topic: ");
  Serial.println(topic);
  Serial.println(jsonBuffer);
  
  client.publish(topic.c_str(), jsonBuffer);

  // Wait 10 seconds before sending the next reading
  delay(10000);
}
