import json
import logging
import paho.mqtt.client as mqtt
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import Node, Telemetry
from .ws_manager import manager
import asyncio

logger = logging.getLogger(__name__)

MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
MQTT_TOPIC = "subsidence/telemetry/#"

def save_telemetry_to_db(payload: dict | list):
    db = SessionLocal()
    try:
        nodes_data = payload if isinstance(payload, list) else [payload]
        for data in nodes_data:
            node_id = data.get("id")
            if not node_id:
                logger.warning("Received telemetry without node ID")
                continue

            node = db.query(Node).filter(Node.id == node_id).first()
            if not node:
                node = Node(
                    id=node_id,
                    name=data.get("name", node_id),
                    lat=data.get("lat"),
                    lng=data.get("lng"),
                    is_reference=data.get("is_reference", False)
                )
                db.add(node)
                db.commit()
                db.refresh(node)

            # Create telemetry record
            telemetry = Telemetry(
                node_id=node.id,
                timestamp=data.get("last_seen", data.get("timestamp")),
                temp_c=data.get("temp_c"),
                tilt_x_raw_mm_per_m=data.get("tilt_x_raw_mm_per_m"),
                tilt_y_raw_mm_per_m=data.get("tilt_y_raw_mm_per_m"),
                tilt_x_mm_per_m=data.get("tilt_x_mm_per_m"),
                tilt_y_mm_per_m=data.get("tilt_y_mm_per_m"),
                tilt_resultant_mm_per_m=data.get("tilt_resultant_mm_per_m"),
                settlement_inferred_mm=data.get("settlement_inferred_mm"),
                vibration_rms_g=data.get("vibration_rms_g"),
                crack_mm=data.get("crack_mm"),
                enclosure_humidity_pct=data.get("enclosure_humidity_pct"),
                battery_pct=data.get("battery_pct"),
                solar_w=data.get("solar_w"),
                rssi_dbm=data.get("rssi_dbm"),
                hops_to_gateway=data.get("hops_to_gateway"),
                parent_node=data.get("parent_node"),
                gateway_id=data.get("gateway_id"),
                packet_loss_pct=data.get("packet_loss_pct"),
                buffered_packets=data.get("buffered_packets"),
                sample_mode=data.get("sample_mode")
            )
            db.add(telemetry)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving telemetry to DB: {e}")
    finally:
        db.close()

def on_connect(client, userdata, flags, rc, properties=None):
    if hasattr(rc, 'is_failure') and not rc.is_failure or rc == 0:
        logger.info(f"Connected to MQTT broker {MQTT_BROKER}")
        client.subscribe(MQTT_TOPIC)
    else:
        logger.error(f"Failed to connect to MQTT broker, return code: {rc}")

def on_message(client, userdata, msg):
    try:
        payload_str = msg.payload.decode('utf-8')
        payload = json.loads(payload_str)
        
        # Save to DB
        save_telemetry_to_db(payload)
        
        # Broadcast to WebSockets
        # We need to run this in the event loop since paho-mqtt runs in its own thread
        loop = userdata.get('loop')
        if loop and loop.is_running():
            ws_payload = payload if isinstance(payload, list) else [payload]
            asyncio.run_coroutine_threadsafe(manager.broadcast(ws_payload), loop)
            
    except Exception as e:
        logger.error(f"Error processing MQTT message: {e}")

def start_mqtt_client(loop: asyncio.AbstractEventLoop):
    import uuid
    client_id = f"sih_backend_{uuid.uuid4().hex[:8]}"
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
    client.user_data_set({'loop': loop})
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
        logger.info("MQTT client started")
        return client
    except Exception as e:
        logger.error(f"Failed to start MQTT client: {e}")
        return None
