import paho.mqtt.client as mqtt
import logging
import uuid

logging.basicConfig(level=logging.DEBUG)

def on_connect(client, userdata, flags, reason_code, properties=None):
    print(f"Connected with result code {reason_code}")
    client.subscribe("subsidence/telemetry/#")

def on_message(client, userdata, msg):
    print(f"Received {msg.topic} {msg.payload}")

client_id = f"test_{uuid.uuid4().hex[:8]}"
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
client.enable_logger()
client.on_connect = on_connect
client.on_message = on_message

print("Connecting...")
client.connect("test.mosquitto.org", 1883, 60)
client.loop_forever()
