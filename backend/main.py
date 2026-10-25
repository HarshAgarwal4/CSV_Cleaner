import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

load_dotenv()

from App.models.database import engine, Base
from App.models.user import UserModel
from App.models.document import DocumentModel
from App.routes.user import userRoutes
from App.routes.document import documentRoutes
from middlewares.Auth import AuthMiddleware

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     # Connect to Neon Postgres and create tables if not exist
#     try:
#         Base.metadata.create_all(bind=engine)
#         print("Connected to Database successfully")
#     except Exception as err:
#         print("Database connection warning (please check DATABASE_URL in .env):", err)
#     port = os.getenv("PORT", "5000")
#     print(f"Server is running on port {port}")
#     yield

app = FastAPI()

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
    return {'msg' : 'Hello world'}

app.include_router(userRoutes)
app.include_router(documentRoutes)