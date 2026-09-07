# SIH 2026 Mine Subsidence - LoRa Mesh Hardware Architecture

This folder contains the embedded C++ (Arduino) code for your ESP32 hardware network.

## The Architecture (LoRa Mesh)

Since mines often lack internet connectivity, your sensor nodes will communicate using **LoRa Mesh Technology**. 

1. **Sensor Nodes (ESPs with LoRa):** Every pillar or vulnerable spot has an ESP32 equipped with:
   - **MPU6050** (for X/Y Tilt and resultant subsidence)
   - **Vibration Sensor** (for seismic activity / blasting impact)
   - **Battery & Solar Panel** (for autonomous charging)
   - **LoRa Module (e.g., SX1278)** (for long-range mesh communication)
   
   These nodes read data and pass it along the mesh network until it reaches the Gateway.

2. **Gateway Node (ESP32 with WiFi + LoRa):** Positioned near the mine entrance or a surface office where WiFi/Ethernet is available. It receives the aggregated LoRa mesh traffic and forwards it to the Railway backend via MQTT (`test.mosquitto.org`).

## Files in this Directory:
- `lora_mesh_node.ino`: Code for the internal mine sensors. Reads MPU6050, Battery ADC, formats a JSON payload, and sends it out via LoRa.
- `lora_wifi_gateway.ino`: Code for the surface gateway. Listens for LoRa packets and pushes them to the Cloud Dashboard via MQTT over WiFi.

## How it integrates with the Dashboard:
The dashboard expects exactly the fields your sensors will provide:
- `tilt_x_raw_mm_per_m` (from MPU6050)
- `vibration_rms_g` (from Vibration sensor)
- `battery_pct` (from analog battery read)
- `solar_w` (from solar charging circuit)

Because of the Mesh Topology, if one node goes offline, the others will route their data through neighboring ESPs, ensuring the dashboard never loses critical subsidence data!
