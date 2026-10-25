# Backend — AI Data Doctor API & Cleaning Agent

FastAPI application powering the autonomous CSV cleaning agent, authentication, Cloudinary asset storage, and PostgreSQL document records.

## Setup Instructions

1. **Create Virtual Environment**:
   ```bash
   python -m venv .venv
   # Windows:
   .\.venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```

4. **Run Server**:
   ```bash
   uvicorn main:app --reload --port 5000
   ```

For full system architecture, API documentation, and details, please refer to the [Root README.md](../README.md).

