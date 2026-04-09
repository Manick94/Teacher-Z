# Teacher-Z

AI-powered SaaS platform for K-12 schools to dynamically generate educational interfaces and content with privacy-first deployment options.

> **Version:** 1.0  
> **Last Updated:** April 10, 2026

## 1) Project Overview

Teacher-Z combines dynamic UI generation, local/edge AI inference, and school-friendly multi-tenant APIs so districts can:

- Generate quizzes, worksheet UIs, and image-driven lesson components.
- Produce curriculum-aligned content with local LLMs.
- Run sensitive inference near schools (edge ONNX runtime) for privacy and low latency.
- Monetize as subscription SaaS (Starter / School / District tiers).

## 2) Core Features

- **Dynamic educational UI generation** with **A2UI + React**.
- **AI content generation** using **TinyLlama/Mistral** class models.
- **Edge inference mode** via **ONNX Runtime** for privacy-sensitive use cases.
- **JWT-based auth** for schools, admins, and teachers.
- **Dataset/content management** via FastAPI endpoints.
- **SaaS-ready architecture** with tenant isolation patterns.

## 3) High-Level Architecture

```text
┌───────────────────────────────┐
│           Frontend            │
│   React + A2UI runtime/editor │
└───────────────┬───────────────┘
                │ HTTPS (JWT)
┌───────────────▼───────────────┐
│            FastAPI            │
│ Auth • Content API • Datasets │
│  LLM Orchestrator • Billing   │
└───────┬───────────────┬───────┘
        │               │
        │               ├─────────────────────┐
        │               │                     │
┌───────▼───────┐ ┌─────▼────────────────┐ ┌──▼────────────────────┐
│   SQLite DB   │ │ Local LLM Runtime    │ │ Edge Inference Nodes  │
│ users/content │ │ TinyLlama/Mistral    │ │ ONNX Runtime (school) │
└───────────────┘ └──────────────────────┘ └───────────────────────┘
```

## 4) Technology Stack

- **Frontend:** React, A2UI
- **Backend:** FastAPI, Uvicorn
- **Auth:** JWT (`python-jose`), password hashing (`passlib`)
- **Data:** SQLite (initial traction stage)
- **AI/LLM:** Transformers + TinyLlama/Mistral
- **Edge Runtime:** ONNX Runtime
- **File/Data processing:** Pillow, `datasets`

## 5) Repository Structure (recommended)

```text
Teacher-Z/
├─ README.md
├─ .env.example
├─ requirements.txt
├─ Dockerfile
├─ docker-compose.yml
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ api/
│  │  ├─ core/
│  │  ├─ services/
│  │  ├─ models/
│  │  └─ db/
│  └─ tests/
├─ frontend/
│  ├─ src/
│  └─ package.json
└─ scripts/
```

> If your current repo layout differs, keep this as your target structure while iterating.

## 6) Local Setup

### Prerequisites

- Python 3.10+
- Node.js 18+ (for frontend)
- pip + venv

### A. Backend setup

```bash
# from repo root
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows PowerShell

pip install --upgrade pip
pip install fastapi uvicorn a2ui transformers onnxruntime pillow datasets python-jose[cryptography] passlib python-multipart
```

Create `.env` (or copy from `.env.example`):

```env
APP_NAME=Teacher-Z
ENV=development
SECRET_KEY=change-this-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
ALGORITHM=HS256
DATABASE_URL=sqlite:///./teacherz.db
MODEL_PROVIDER=local
MODEL_NAME=TinyLlama/TinyLlama-1.1B-Chat-v1.0
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

Run API:

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Docs:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### B. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

App URL (typical Vite): `http://localhost:5173`

## 7) Deployment Guide (Free-first)

You asked for **Render.com or Fly.io** with minimal/no initial cost.

---

### Option A: Render (easiest free-first workflow)

#### 1. Create Web Service

- Push repo to GitHub.
- In Render dashboard: **New + → Web Service**.
- Connect repo and branch.

#### 2. Build & Start settings

- **Runtime:** Python
- **Build Command:**

```bash
pip install -r requirements.txt
```

- **Start Command:**

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
```

#### 3. Environment variables

Set:

- `SECRET_KEY` (strong random value)
- `ALGORITHM=HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES=60`
- `DATABASE_URL=sqlite:///./teacherz.db` (OK for early prototype)
- `MODEL_PROVIDER=local`
- `MODEL_NAME=TinyLlama/TinyLlama-1.1B-Chat-v1.0`

#### 4. Notes for free-tier traction

- Free instances may sleep when idle (cold starts).
- Prefer small models or endpoint-level caching.
- For reliability beyond MVP, move to managed Postgres and persistent model storage.

---

### Option B: Fly.io (better control, global edge)

#### 1. Install Fly CLI and login

```bash
fly auth login
```

#### 2. Initialize app

```bash
fly launch
```

When prompted:

- Pick app name (e.g., `teacher-z-api`)
- Region near pilot schools
- Use generated `fly.toml`

#### 3. Set secrets

```bash
fly secrets set SECRET_KEY="replace-with-strong-secret"
fly secrets set ALGORITHM="HS256"
fly secrets set ACCESS_TOKEN_EXPIRE_MINUTES="60"
fly secrets set DATABASE_URL="sqlite:///data/teacherz.db"
fly secrets set MODEL_PROVIDER="local"
fly secrets set MODEL_NAME="TinyLlama/TinyLlama-1.1B-Chat-v1.0"
```

#### 4. Attach volume for SQLite persistence

```bash
fly volumes create teacherz_data --region <region> --size 1
```

Mount the volume at `/data` in `fly.toml`.

#### 5. Deploy

```bash
fly deploy
```

#### 6. Notes for free-tier traction

- Keep memory profile small; quantized models recommended.
- Consider splitting heavy LLM jobs into async worker process.

## 8) Minimal Docker Setup

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}"]
```

### docker-compose.yml

```yaml
services:
  api:
    build: .
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - ./:/app
```

Run:

```bash
docker compose up --build
```

## 9) Security Checklist (must-do before onboarding schools)

- Rotate `SECRET_KEY` and never commit `.env`.
- Enforce HTTPS in production (Render/Fly handle TLS termination).
- Add role-based access control (district admin, school admin, teacher).
- Validate uploaded files and dataset MIME types.
- Add request throttling/rate limits for inference endpoints.
- Log audit events for content generation and dataset operations.
- For student data (FERPA-sensitive), keep PII out of prompts and enable edge inference.

## 10) Suggested Next Production Steps

1. Replace SQLite with Postgres (Render/Fly managed DB).
2. Add Alembic migrations.
3. Add Redis queue + background workers for generation jobs.
4. Add billing (Stripe) + tenant quotas.
5. Add CI/CD (GitHub Actions: lint, test, build, deploy).
6. Add observability (OpenTelemetry + Sentry).

## 11) License & OSS Readiness

Suggested:

- **License:** Apache-2.0 (good for SaaS + enterprise adoption)
- Add `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`.

## 12) Quick Start (TL;DR)

```bash
python -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn a2ui transformers onnxruntime pillow datasets python-jose[cryptography] passlib python-multipart
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Then open `http://localhost:8000/docs`.

---

If you want, the next step can be a **full production scaffold** (FastAPI app skeleton + auth + dataset CRUD + AI service layer + Docker + Fly/Render manifests) generated directly in this repository.
