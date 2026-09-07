#include <WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <LoRa.h>
#include <ArduinoJson.h>

// --- WiFi Credentials ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// --- MQTT Broker Settings ---
const char* mqtt_server = "test.mosquitto.org";
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient mqttClient(espClient);

void setup_wifi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void reconnect_mqtt() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = "ESP32Gateway-";
    clientId += String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  // Setup WiFi & MQTT
  setup_wifi();
  mqttClient.setServer(mqtt_server, mqtt_port);

  // Setup LoRa Receiver
  LoRa.setPins(5, 14, 2); 
  if (!LoRa.begin(433E6)) {
    Serial.println("Starting LoRa failed!");
    while (1);
  }
  Serial.println("Gateway Ready. Listening for LoRa Mesh Nodes...");
}

void loop() {
  if (!mqttClient.connected()) {
    reconnect_mqtt();
  }
  mqttClient.loop();

  // Check for incoming LoRa packets from Nodes
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incoming = "";
    while (LoRa.available()) {
      incoming += (char)LoRa.read();
    }
    
    Serial.println("Received LoRa Packet: " + incoming);

    // Extract node_id from JSON to publish to correct topic
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, incoming);
    
    if (!error) {
      String nodeId = doc["node_id"].as<String>();
      String topic = "subsidence/telemetry/" + nodeId;
      
      // Forward the exact JSON to the Cloud via MQTT
      mqttClient.publish(topic.c_str(), incoming.c_str());
      Serial.println("Forwarded to Cloud Topic: " + topic);
    }
  }
}
