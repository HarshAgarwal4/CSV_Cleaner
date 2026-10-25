import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

load_dotenv()

from sqlalchemy import text
from App.models.database import engine, Base
from App.models.user import UserModel
from App.models.document import DocumentModel
from App.routes.user import userRoutes
from App.routes.document import documentRoutes
from middlewares.Auth import AuthMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect to Neon Postgres and create tables if not exist
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
        print("Connected to Database successfully & schema verified")
    except Exception as err:
        print("Database connection warning (please check DATABASE_URL in .env):", err)
    port = os.getenv("PORT", "5000")
    print(f"Server is running on port {port}")
    yield

app = FastAPI(lifespan=lifespan)

# CORS configuration
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
origins = [frontend_url] if frontend_url else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth Middleware (equivalent to app.use(isLoggedIn))
app.add_middleware(AuthMiddleware)

@app.get("/")
def home():
    return PlainTextResponse("Hello World")

app.include_router(userRoutes)
app.include_router(documentRoutes)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
