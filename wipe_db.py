from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from backend.app.models import Base, Node, Telemetry
from backend.app.database import engine, SessionLocal

db = SessionLocal()
try:
    db.query(Telemetry).delete()
    db.query(Node).delete()
    db.commit()
    print("Database wiped successfully!")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
