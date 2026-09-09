import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("app.database")

# MySQL Configuration
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
MYSQL_DB = os.getenv("MYSQL_DATABASE", "subsidence")

DEFAULT_MYSQL_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_MYSQL_URL)

def get_engine():
    global DATABASE_URL
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    elif DATABASE_URL.startswith("mysql://"):
        DATABASE_URL = DATABASE_URL.replace("mysql://", "mysql+pymysql://", 1)

    connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

    try:
        eng = create_engine(
            DATABASE_URL,
            connect_args=connect_args,
            pool_pre_ping=True,
            pool_recycle=3600 if not DATABASE_URL.startswith("sqlite") else None,
        )
        with eng.connect() as conn:
            pass
        print(f"Connected successfully to database: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
        return eng
    except Exception as e:
        print(f"Notice: MySQL at {DATABASE_URL} is not currently running or reachable: {e}")
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        fallback_url = f"sqlite:///{os.path.join(BASE_DIR, 'subsidence.db')}"
        print(f"Falling back to local SQLite ({fallback_url}) until MySQL server is started.")
        return create_engine(fallback_url, connect_args={"check_same_thread": False})

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
