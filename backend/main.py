import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from App.models.database import engine, Base
from App.models.user import UserModel
from App.models.document import DocumentModel
from App.routes.user import userRoutes
from App.routes.document import documentRoutes
from middlewares.Auth import AuthMiddleware


# Create FastAPI application for serverless deployment
app = FastAPI()


# CORS configuration
frontend_url = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173"
)

origins = [
    url.strip()
    for url in frontend_url.split(",")
    if url.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Authentication middleware
app.add_middleware(AuthMiddleware)


# Root endpoint
@app.get("/")
def home():
    return {"message": "Hello world"}


# Health check endpoint
@app.get("/health")
def health():
    return {"status": "healthy"}


# Register existing routers
app.include_router(userRoutes)
app.include_router(documentRoutes)


# IMPORTANT:
# Do not run database migrations or create tables on every
# serverless invocation. Apply schema changes separately.
# Vercel imports this module-level "app" instance directly.