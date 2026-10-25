import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# -----------------------------------------------------------------------------
# 1. Serverless Path & Environment Setup
# -----------------------------------------------------------------------------
# Ensure the backend directory is in sys.path regardless of serverless CWD
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Load environment variables
load_dotenv(dotenv_path=BACKEND_DIR / ".env")

from sqlalchemy import text
from App.models.database import engine, Base
from App.models.user import UserModel
from App.models.document import DocumentModel
from App.routes.user import userRoutes
from App.routes.document import documentRoutes
from middlewares.Auth import AuthMiddleware

# -----------------------------------------------------------------------------
# 2. Resilient Database Initialization (Serverless Cold-Start Safe)
# -----------------------------------------------------------------------------
_db_initialized = False


def init_db():
    """Idempotent database schema initialisation safe for serverless cold-starts."""
    global _db_initialized
    if _db_initialized:
        return
    try:
        Base.metadata.create_all(bind=engine)
        if engine.dialect.name == "postgresql":
            with engine.connect() as conn:
                stmts = [
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS cleaned_file_url VARCHAR;",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS cleaned_public_id VARCHAR;",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS cleaned_file_size INTEGER DEFAULT 0;",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS cleaned_row_count INTEGER DEFAULT 0;",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS initial_analysis JSON DEFAULT '{}'::json;",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS final_analysis JSON DEFAULT '{}'::json;",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS review JSON DEFAULT '{}'::json;",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS cleaning_error VARCHAR;",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS cleaned_at TIMESTAMP WITHOUT TIME ZONE;",
                ]
                for stmt in stmts:
                    conn.execute(text(stmt))
                conn.commit()
        _db_initialized = True
        print("[DATABASE] Schema verified & tables ready.")
    except Exception as err:
        print("[DATABASE WARNING] Schema verification skipped or failed:", err)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run DB schema check on lifespan startup if runtime supports ASGI lifespan
    init_db()
    port = os.getenv("PORT", "5000")
    print(f"[STARTUP] Server initialized (Port: {port} / Serverless ready)")
    yield


# -----------------------------------------------------------------------------
# 3. FastAPI Application Factory
# -----------------------------------------------------------------------------
app = FastAPI(
    title="AI CSV Cleaning & Analytics API",
    description="Autonomous LangGraph-powered CSV Cleaning, Cloudinary Storage & Analytics API",
    version="1.0.0",
    lifespan=lifespan,
)

# -----------------------------------------------------------------------------
# 4. CORS Configuration (Dynamic for Serverless & Previews)
# -----------------------------------------------------------------------------
frontend_env = os.getenv("FRONTEND_URL", "http://localhost:5173")
# Support comma-separated list of allowed origins
allowed_origins = [url.strip() for url in frontend_env.split(",") if url.strip()]
if "http://localhost:5173" not in allowed_origins:
    allowed_origins.append("http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",  # Allows all Vercel preview branch deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# 5. Middlewares & Routing
# -----------------------------------------------------------------------------
app.add_middleware(AuthMiddleware)


@app.get("/")
def home():
    return {
        "status": "online",
        "service": "AI CSV Cleaner & Analytics API",
        "architecture": "serverless-compatible",
    }


@app.get("/health")
def health_check():
    """Fast, lightweight health check endpoint for serverless keepalive & monitoring."""
    return {"status": "healthy", "database_ready": _db_initialized}


app.include_router(userRoutes)
app.include_router(documentRoutes)

# -----------------------------------------------------------------------------
# 6. Serverless ASGI Handlers (AWS Lambda / Vercel / Netlify / Standalone)
# -----------------------------------------------------------------------------
try:
    from mangum import Mangum
    # AWS Lambda / Netlify serverless handler
    handler = Mangum(app, lifespan="auto")
except ImportError:
    handler = app

# For local direct execution: python main.py
if __name__ == "__main__":
    init_db()
    port = int(os.getenv("PORT", "5000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
