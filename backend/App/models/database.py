import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

def get_database_url() -> str:
    db_url = os.getenv("DATABASE_URL") or os.getenv("DB_URL")
    if not db_url or "your_neon_password" in db_url or "ep-your-instance" in db_url:
        # Fallback to local SQLite if Neon credentials are still placeholder templates
        return "sqlite:///./dev.db"

    # Neon PostgreSQL URLs typically start with postgres:// or postgresql://
    # SQLAlchemy using psycopg3 driver requires postgresql+psycopg://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

    return db_url

db_url = get_database_url()

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# pool_pre_ping=True helps handle Neon serverless Postgres connection drops/wakeups
engine = create_engine(
    db_url,
    pool_pre_ping=True,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def get_db_context():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

