import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))

def get_database_url() -> str:
    db_url = os.getenv("DATABASE_URL") or os.getenv("DB_URL")
    if not db_url or "your_neon_password" in db_url or "ep-your-instance" in db_url:
        # Fallback to local SQLite if Neon credentials are still placeholder templates.
        # On Vercel / serverless runtimes, root filesystem is read-only, so use /tmp.
        if is_serverless or (os.path.exists("/tmp") and os.access("/tmp", os.W_OK)):
            return "sqlite:////tmp/dev.db"
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

# Build engine configuration
engine_kwargs = {
    "pool_pre_ping": True,
    "connect_args": connect_args,
}

# In serverless environments, disable pooling with NullPool to prevent connection exhaustion
if is_serverless and not db_url.startswith("sqlite"):
    engine_kwargs["poolclass"] = NullPool

engine = create_engine(db_url, **engine_kwargs)

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

