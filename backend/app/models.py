from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class Area(Base):
    __tablename__ = "areas"
    id = Column(String(100), primary_key=True, index=True)
    name = Column(String(255), index=True)
    description = Column(String(500))

class Gateway(Base):
    __tablename__ = "gateways"
    id = Column(String(100), primary_key=True, index=True)
    name = Column(String(255), index=True)
    area_id = Column(String(100))
    lat = Column(Float)
    lng = Column(Float)
    status = Column(String(50))

class Node(Base):
    __tablename__ = "nodes"

    id = Column(String(100), primary_key=True, index=True)
    name = Column(String(255), index=True)
    panel_id = Column(String(100))
    gateway_id = Column(String(100))
    lat = Column(Float)
    lng = Column(Float)
    gps_fix = Column(String(50))
    install_date = Column(String(50))
    spacing_m = Column(Float)
    is_reference = Column(Boolean, default=False)
    firmware = Column(String(50))

    telemetry = relationship("Telemetry", back_populates="node", cascade="all, delete-orphan")

class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(String(100), ForeignKey("nodes.id"))
    timestamp = Column(Float, default=lambda: datetime.utcnow().timestamp() * 1000)
    
    # Measured values
    temp_c = Column(Float)
    tilt_x_raw_mm_per_m = Column(Float)
    tilt_y_raw_mm_per_m = Column(Float)
    vibration_rms_g = Column(Float)
    crack_mm = Column(Float)
    enclosure_humidity_pct = Column(Float)
    battery_pct = Column(Float)
    solar_w = Column(Float)
    rssi_dbm = Column(Float)

    # Derived values
    tilt_x_mm_per_m = Column(Float)
    tilt_y_mm_per_m = Column(Float)
    tilt_resultant_mm_per_m = Column(Float)
    settlement_inferred_mm = Column(Float)

    # Link values
    hops_to_gateway = Column(Integer)
    parent_node = Column(String(100))
    gateway_id = Column(String(100))
    packet_loss_pct = Column(Float)
    buffered_packets = Column(Integer)
    sample_mode = Column(String(50))

    node = relationship("Node", back_populates="telemetry")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(255))
    name = Column(String(255))
    role = Column(String(100))
    avatar_url = Column(String(500))
