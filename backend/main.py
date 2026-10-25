import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Ensure backend root directory and parent are on sys.path for serverless runtimes
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))
if str(current_dir.parent) not in sys.path:
    sys.path.insert(0, str(current_dir.parent))

# Load .env file if it exists locally
load_dotenv()

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from App.models.database import engine, Base
from App.models.user import UserModel
from App.models.document import DocumentModel
from App.routes.user import userRoutes
from App.routes.document import documentRoutes
from middlewares.Auth import AuthMiddleware

# Flag to prevent repeated schema migrations on every serverless execution
_schema_initialized = False

def init_database_schema():
    global _schema_initialized
    if _schema_initialized:
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
        _schema_initialized = True
        print("Connected to Database successfully & schema verified")
    except Exception as err:
        print("Database connection warning (please check DATABASE_URL):", err)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # In local development, verify and migrate database schema
    is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
    if not is_serverless:
        init_database_schema()
    else:
        # In serverless, skip blocking DDL migrations on cold-start to prevent timeouts
        print("[SERVERLESS] Serverless runtime detected. Skipping cold-start DDL migrations.")
    yield

app = FastAPI(
    title="AI Data Doctor API",
    description="Autonomous CSV Cleaning & Analytics Platform",
    lifespan=lifespan,
)

# CORS configuration
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
allowed_origins = [
    frontend_url,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set([o for o in allowed_origins if o])),
    allow_origin_regex=r"https?://.*\.vercel\.app",  # Automatically permit all Vercel deployments & previews
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth Middleware (equivalent to app.use(isLoggedIn))
app.add_middleware(AuthMiddleware)

@app.get("/")
def home():
    return {
        "status": "ok",
        "message": "AI Data Doctor API is running successfully",
        "environment": "serverless" if os.getenv("VERCEL") else "local",
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

app.include_router(userRoutes)
app.include_router(documentRoutes)

# Serverless entrypoint compatibility (for Vercel @vercel/python / Mangum)
handler = app

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"Server is running on port {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
