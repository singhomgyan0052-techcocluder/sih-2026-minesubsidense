import asyncio
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import engine, Base, get_db
from .models import Node, Telemetry, Area, Gateway, User
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import HTTPException, status
from datetime import timedelta
from .auth import verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user
from .ws_manager import manager
from .mqtt_client import start_mqtt_client

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from ai.lstm_predictor import predict_failure_risk
except ImportError:
    pass

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

# Seed default user
from sqlalchemy.orm import sessionmaker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()
if not db.query(User).filter(User.username == "officer").first():
    default_user = User(
        username="officer",
        hashed_password=get_password_hash("admin123"),
        name="Officer NodeAdmin",
        role="admin",
        avatar_url=""
    )
    db.add(default_user)
    db.commit()
db.close()

app = FastAPI(title="Mine Subsidence API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mqtt_client = None

@app.on_event("startup")
async def startup_event():
    global mqtt_client
    loop = asyncio.get_running_loop()
    mqtt_client = start_mqtt_client(loop)

@app.on_event("shutdown")
async def shutdown_event():
    global mqtt_client
    if mqtt_client:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

from pydantic import BaseModel

from sqlalchemy import func

class UserCreate(BaseModel):
    username: str
    password: str
    name: str

@app.post("/api/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    clean_username = user.username.strip().lower()
    existing = db.query(User).filter(func.lower(User.username) == clean_username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = User(
        username=clean_username,
        hashed_password=get_password_hash(user.password),
        name=user.name,
        role="Officer",
        avatar_url=""
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully", "username": new_user.username}

@app.post("/api/login")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    clean_username = form_data.username.strip().lower()
    user = db.query(User).filter(func.lower(User.username) == clean_username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role, "name": user.name}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/nodes")
def get_nodes(db: Session = Depends(get_db)):
    nodes = db.query(Node).all()
    return nodes

@app.get("/api/nodes/{node_id}/ai_risk")
def get_node_ai_risk(node_id: str):
    try:
        return predict_failure_risk(node_id)
    except Exception as e:
        return {"error": str(e), "ai_risk_probability": 0}

@app.post("/api/nodes")
def create_node(node_data: dict = Body(...), db: Session = Depends(get_db)):
    logger.info(f"Received request to create node: {node_data}")
    existing = db.query(Node).filter(Node.id == node_data.get('id')).first()
    if not existing:
        new_node = Node(
            id=node_data.get('id'),
            name=node_data.get('name'),
            panel_id=node_data.get('panel_id', 'PANEL-A'),
            gateway_id=node_data.get('gateway_id'),
            lat=node_data.get('lat', 23.7485),
            lng=node_data.get('lng', 86.4250),
            gps_fix=node_data.get('gps_fix', '3D'),
            install_date=node_data.get('install_date', '2026-09-06'),
            spacing_m=node_data.get('spacing_m', 25.0),
            is_reference=node_data.get('is_reference', False),
            firmware=node_data.get('firmware', 'v2.4.1'),
        )
        db.add(new_node)
        db.commit()
        db.refresh(new_node)
        return {"status": "success", "node": new_node.id}
    return {"status": "exists", "node": existing.id}

@app.get("/api/gateways")
def get_gateways(db: Session = Depends(get_db)):
    return db.query(Gateway).all()

@app.post("/api/gateways")
def create_gateway(gateway_data: dict = Body(...), db: Session = Depends(get_db)):
    logger.info(f"Gateway created request: {gateway_data}")
    existing = db.query(Gateway).filter(Gateway.id == gateway_data.get('id')).first()
    if not existing:
        new_gateway = Gateway(
            id=gateway_data.get('id'),
            name=gateway_data.get('name'),
            area_id=gateway_data.get('area_id'),
            lat=gateway_data.get('lat'),
            lng=gateway_data.get('lng'),
            status=gateway_data.get('status', 'offline')
        )
        db.add(new_gateway)
        db.commit()
        db.refresh(new_gateway)
        return {"status": "success", "gateway": new_gateway.id}
    return {"status": "exists", "gateway": existing.id}

@app.get("/api/areas")
def get_areas(db: Session = Depends(get_db)):
    return db.query(Area).all()

@app.post("/api/areas")
def create_area(area_data: dict = Body(...), db: Session = Depends(get_db)):
    logger.info(f"Area created request: {area_data}")
    existing = db.query(Area).filter(Area.id == area_data.get('id')).first()
    if not existing:
        new_area = Area(
            id=area_data.get('id'),
            name=area_data.get('name'),
            description=area_data.get('description', '')
        )
        db.add(new_area)
        db.commit()
        db.refresh(new_area)
        return {"status": "success", "area": new_area.id}
    return {"status": "exists", "area": existing.id}

@app.get("/api/nodes/{node_id}/history")
def get_node_history(node_id: str, limit: int = 100, db: Session = Depends(get_db)):
    history = db.query(Telemetry).filter(Telemetry.node_id == node_id).order_by(Telemetry.timestamp.desc()).limit(limit).all()
    return history
