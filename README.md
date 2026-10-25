# 🧹 AI Data Doctor — Autonomous CSV Cleaning & Analytics Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![LangGraph](https://img.shields.io/badge/AI%20Agent-LangGraph-FF4F00?style=flat-square)](https://langchain-ai.github.io/langgraph/)
[![Groq](https://img.shields.io/badge/LLM-Groq%20Cloud-F55036?style=flat-square)](https://groq.com/)
[![Cloudinary](https://img.shields.io/badge/Storage-Cloudinary-3448C5?style=flat-square&logo=cloudinary&logoColor=white)](https://cloudinary.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-Neon%20Postgres-00E699?style=flat-square&logo=postgresql&logoColor=black)](https://neon.tech/)
[![PapaParse](https://img.shields.io/badge/Parser-Papa%20Parse-FF6B6B?style=flat-square)](https://www.papaparse.com/)

An end-to-end, enterprise-grade AI system that autonomously inspects, fixes, transforms, and audits messy CSV datasets. Powered by a multi-node **LangGraph AI Agent** and a modern **React 19 Dashboard** with client-side **Papa Parse** side-by-side data comparison.

---

## 🌟 Key Features

- **Autonomous Multi-Step AI Agent**:
  - Automatically parses column structures, detects corrupted headers, and handles encodings.
  - Generates LLM-backed cleaning rules tailored to the dataset.
  - Fixes erroneous types, imputes missing values, clips statistical outliers, and eliminates duplicate rows.
  - Runs an automated **Review Node**: samples 25 random rows before & after, calculates an audit score out of 10, categorizes *"What Actually Improved"* vs *"Things to Improve"*, and retries in a closed loop if score < 6.5 (up to 5 attempts).
- **Zero Database Bloat (SQL-Light Architecture)**:
  - Dataset rows are **never** stored in relational SQL tables.
  - Raw and AI-cleaned CSV files are stored as secure raw assets in **Cloudinary**.
  - PostgreSQL stores only metadata, public Cloudinary URLs, and structured JSON audit metrics.
- **In-Browser Papa Parse Engine**:
  - Validates CSV structure directly in the browser before network transmission.
  - Streams and parses raw vs AI-cleaned CSV files side-by-side inside an interactive comparison modal without server proxies.
- **Deep Analytics Dashboard**:
  - Aggregate KPIs (total files, cleaned files, total valid records, average audit quality score).
  - Side-by-side pagination grid with live text search.
  - Column schema health matrix (data types, primary key flags, null rates, and cleaning transformations).
  - 1-click downloads and Cloudinary link copying.
- **Secure Authentication & OTP Verification**:
  - JWT HTTP-only cookie session management with role-based access.
  - 6-digit OTP verification via Gmail SMTP service.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    User([User Browser]) -->|1. Validate with PapaParse & Upload CSV| Backend[FastAPI Server :5000]
    Backend -->|2. Upload Raw CSV| Cloudinary[(Cloudinary Raw Storage)]
    Backend -->|3. Store Metadata & URL| NeonDB[(Neon PostgreSQL / SQLite)]
    
    User -->|4. Click 'Clean with AI Agent'| Backend
    Backend -->|5. Pass Cloudinary URL| Agent[LangGraph AI Cleaning Agent]
    
    subgraph LangGraph AI Pipeline
        P[Parsing Node] --> RG[Rule Generator Node - Groq LLM]
        RG --> MC[Column Cleaning Node]
        MC --> MR[Row & Outlier Node]
        MR --> FC[Final Cleaning Node]
        FC --> RV{Review Node\nScore >= 6.5?}
        RV -->|Score < 6.5 & Retries < 5| RG
        RV -->|Passed or Max Retries| Done[Cleaning Complete]
    end
    
    Agent -->|6. Upload Cleaned CSV| Cloudinary
    Agent -->|7. Return Audit Score & Metrics| Backend
    Backend -->|8. Update Document in DB| NeonDB
    User -->|9. Stream & Compare CSVs via PapaParse| Cloudinary
```

---

## 📁 Repository Structure

```text
├── backend/
│   ├── AI/
│   │   ├── agent.py               # LangGraph StateGraph definition & pipeline
│   │   └── nodes/                 # Modular cleaning nodes
│   │       ├── parsing_node.py
│   │       ├── rule_generator_node.py
│   │       ├── manual_col.py
│   │       ├── manual_col_clean_node.py
│   │       ├── manual_row.py
│   │       ├── final_clean_node.py
│   │       └── review_node.py     # 25-row comparison, scoring & retry loop
│   ├── App/
│   │   ├── config/                # Database connection utilities
│   │   ├── controllers/           # Auth and Document API handlers
│   │   ├── models/                # User and Document SQLAlchemy models
│   │   └── routes/                # FastAPI router definitions
│   ├── middlewares/               # JWT Cookie Authentication middleware
│   ├── services/                  # Cloudinary upload, Mail SMTP, OTP generators
│   ├── main.py                    # FastAPI application entrypoint & startup migrations
│   ├── requirements.txt           # Python dependencies
│   └── .env.example               # Backend environment template
│
├── frontend/
│   ├── src/
│   │   ├── components/            # CsvComparisonModal, Navbar, Sidebar
│   │   ├── pages/                 # Dashboard, Login, Register, OTP Verify
│   │   ├── services/              # Axios API client configured with credentials
│   │   └── store/                 # Zustand authentication state store
│   ├── package.json               # Node.js dependencies (React 19, PapaParse, Tailwind)
│   ├── vite.config.js             # Vite development server configuration
│   └── .env.example               # Frontend environment template
│
└── README.md                      # Project documentation
```

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.10+** (Python 3.11 or 3.12 recommended)
- **Node.js 18+** & **npm 9+**
- Free external API accounts:
  - [Groq Cloud](https://console.groq.com/) (Free fast LLM inference)
  - [Cloudinary](https://cloudinary.com/) (Free cloud media & raw file storage)
  - [Neon Tech](https://neon.tech/) (Free Serverless PostgreSQL, or use local SQLite fallback)
  - Gmail Account with an [App Password](https://myaccount.google.com/apppasswords) (for OTP delivery)

---

## 🚀 Setup & Installation

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd week1
```

---

### Step 2: Backend Configuration & Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a Python virtual environment**:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install backend dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure backend environment variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Open `backend/.env` in your text editor and fill in your credentials:
   ```dotenv
   PORT=5000
   FRONTEND_URL=http://localhost:5173

   # Neon PostgreSQL Connection String (or leave blank to use sqlite:///./dev.db)
   DATABASE_URL=postgresql://username:password@ep-your-instance.us-east-2.aws.neon.tech/neondb?sslmode=require

   # JWT Secret for Session Cookies
   JWT_SECRET=your_jwt_secret_key

   # Gmail SMTP for sending OTP emails
   myGMAIL=your_email@gmail.com
   password=your_16_char_gmail_app_password

   # Cloudinary Storage
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # Groq API Key (for LangGraph AI Agent)
   GROQ_API_KEY=gsk_your_groq_api_key
   ```

---

### Step 3: Frontend Configuration & Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd ../frontend
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Configure frontend environment variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Ensure `frontend/.env` points to the backend server:
   ```dotenv
   VITE_REACT_APP_BACKEND_URL=http://localhost:5000
   ```

---

## 🏃 Running the Application

### 1. Start the Backend API
From the `backend` folder (with virtual environment active):
```bash
uvicorn main:app --reload --port 5000
```
> The API server will boot up on `http://localhost:5000`. On startup, it automatically verifies and runs schema migrations on the database.

### 2. Start the Frontend Client
From the `frontend` folder:
```bash
npm run dev
```
> The React application will start on `http://localhost:5173`.

### 3. Open in Browser
Navigate to [http://localhost:5173](http://localhost:5173).
1. Register a new account (an OTP will be emailed to you).
2. Enter the 6-digit OTP to verify and sign in.
3. Access your **Dashboard**:
   - Drag & drop or select any `.csv` file.
   - The file is validated in-browser with **Papa Parse** and uploaded to Cloudinary.
   - Click **⚡ Clean with AI Agent**.
   - Watch the LangGraph agent run the automated rule generation, cleaning, and review loop.
   - Click **📊 Compare CSVs** to inspect raw vs cleaned data side-by-side with full analytics.

---

## 📡 API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/register` | Register user and trigger email OTP |
| `POST` | `/verify-otp` | Verify OTP code and issue JWT cookie |
| `POST` | `/login` | Authenticate existing user |
| `GET` | `/profile` | Retrieve authenticated user information |
| `POST` | `/logout` | Invalidate session cookie |

### Document Management (`/api/documents`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/upload` | Validate CSV, upload raw file to Cloudinary, save record |
| `GET` | `/` | Fetch all documents belonging to authenticated user |
| `GET` | `/{id}` | Fetch document metadata & cleaning analytics by ID |
| `POST` | `/{id}/clean` | Execute LangGraph AI cleaning pipeline on document |
| `DELETE`| `/{id}` | Delete document record and associated Cloudinary assets |

---

## 🤖 AI Cleaning Pipeline Workflow

```
[Upload CSV URL]
       │
       ▼
 [Parsing Node] ────────► Validates structure, column headers, shape, missing rate
       │
       ▼
 [Rule Generator] ──────► Groq LLM generates column rules (types, bounds, imputations)
       │
       ▼
[Column Clean Node] ───► Standardizes names, handles type conversions
       │
       ▼
  [Row Clean Node] ─────► Eliminates duplicate rows, applies outlier capping
       │
       ▼
[Final Clean Node] ────► Final schema validation, null filling, exports cleaned CSV
       │
       ▼
  [Review Node] ────────► Samples 25 random original vs cleaned rows
       │                  Calculates audit score out of 10
       │                  Compiles "What Improved" vs "Things to Improve"
       ├─── Score < 6.5 & Attempts < 5 ───► Loops back to [Rule Generator]
       │
       └─── Score >= 6.5 (or max attempts) ──► Uploads cleaned CSV to Cloudinary
                                               Saves audit analytics to Database
```

---

## 🛡️ License

This project is licensed under the MIT License.

