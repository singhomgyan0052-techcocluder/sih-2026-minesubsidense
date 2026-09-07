import urllib.request
import json
import time
import random
import paho.mqtt.client as mqtt

MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
MQTT_TOPIC = "subsidence/telemetry/mock"

SEED_NODES = [
    {"id": "NODE-001", "name": "Panel A · Shaft Entry", "lat": 23.7461, "lng": 86.4132, "is_reference": False},
    {"id": "NODE-002", "name": "Panel A · Ventilation Duct", "lat": 23.7495, "lng": 86.4198, "is_reference": False},
    {"id": "NODE-003", "name": "Panel A · Main Gallery", "lat": 23.7510, "lng": 86.4075, "is_reference": False},
    {"id": "NODE-004", "name": "Panel A · Coal Face", "lat": 23.7438, "lng": 86.4265, "is_reference": False},
    {"id": "NODE-005", "name": "Panel A · Pillar Zone", "lat": 23.7530, "lng": 86.4155, "is_reference": False},
    {"id": "NODE-006", "name": "Panel A · Surface Crack", "lat": 23.7475, "lng": 86.4310, "is_reference": False},
    {"id": "NODE-007", "name": "Panel A · Collapse Risk", "lat": 23.7420, "lng": 86.4110, "is_reference": False},
    {"id": "NODE-008", "name": "Panel A · Boundary Post", "lat": 23.7445, "lng": 86.4020, "is_reference": True},
]

def fetch_nodes():
    try:
        req = urllib.request.Request("http://localhost:8000/api/nodes")
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Failed to fetch nodes: {e}")
        return []

def generate_telemetry(node):
    now_ms = int(time.time() * 1000)
    
    tilt_x = 0.0 if node.get("is_reference") else round(random.uniform(0.1, 4.0), 2)
    tilt_y = 0.0 if node.get("is_reference") else round(random.uniform(0.1, 4.0), 2)
    settlement = 0.0 if node.get("is_reference") else round(random.uniform(-30.0, -1.0), 1)
    
    return {
        "id": node["id"],
        "name": node["name"],
        "lat": node["lat"],
        "lng": node["lng"],
        "is_reference": node.get("is_reference", False),
        "last_seen": now_ms,
        "timestamp": now_ms,
        
        "temp_c": round(random.uniform(25.0, 35.0), 1),
        "tilt_x_raw_mm_per_m": tilt_x,
        "tilt_y_raw_mm_per_m": tilt_y,
        "tilt_x_mm_per_m": tilt_x,
        "tilt_y_mm_per_m": tilt_y,
        "tilt_resultant_mm_per_m": round((tilt_x**2 + tilt_y**2)**0.5, 2),
        "settlement_inferred_mm": settlement,
        "vibration_rms_g": round(random.uniform(0.01, 0.25), 3),
        "crack_mm": round(random.uniform(0.5, 3.5), 1),
        "enclosure_humidity_pct": random.randint(40, 80),
        "battery_pct": random.randint(50, 100),
        "solar_w": round(random.uniform(1.0, 5.0), 1),
        "rssi_dbm": random.randint(-110, -60),
        
        "hops_to_gateway": random.randint(1, 4),
        "parent_node": "NODE-PARENT",
        "gateway_id": node.get("gateway_id", "GW-1"),
        "packet_loss_pct": random.randint(0, 5),
        "buffered_packets": 0,
        "sample_mode": "normal"
    }

def main():
    # Use newer API version to avoid deprecation warning
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    
    try:
        print(f"Connecting to MQTT broker {MQTT_BROKER}...")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
        print("Connected! Simulating telemetry...")
        
        while True:
            nodes = fetch_nodes()
            if not nodes:
                print("No nodes found in DB or API is down. Using SEED_NODES fallback...")
                nodes = SEED_NODES
                
            # Publish a batch of node telemetry data
            payloads = [generate_telemetry(n) for n in nodes]
            
            # The frontend websocket handler expects either an array of nodes or a single object.
            # We'll publish as a JSON array to mock the batch.
            payload_str = json.dumps(payloads)
            
            client.publish(MQTT_TOPIC, payload_str)
            print(f"Published {len(payloads)} node telemetry records to {MQTT_TOPIC}")
            
            # Publish every 5 seconds for demonstration purposes
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\nStopping simulator...")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
