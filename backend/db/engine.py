# db.py
import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("TI_OPS_DATABASE_URL")
    or "postgresql+psycopg2://bea:<PASSWORD>@127.0.0.1:5432/ti_ops"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ✅ Dependency FastAPI (ORM)
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ✅ Connection crudo (SQL directo)
@contextmanager
def get_connection():
    conn = engine.connect()
    try:
        yield conn
    finally:
        conn.close()

# --- added by Catastro: engine dependency helper ---
def get_engine():
    return engine
