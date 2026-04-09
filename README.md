# Teacher-Z

Edge AI platform for K-12 teachers. Drop images into a folder, click one, get an instant interactive lesson — quizzes, flashcards, worksheets, and annotated images — all generated locally with no cloud dependency.

> **Version:** 1.0 | **Stack:** FastAPI · React · A2UI · TinyLlama · BLIP · SQLite

---

## Table of Contents

1. [What It Does](#1-what-it-does)
2. [UI Overview](#2-ui-overview)
3. [Architecture](#3-architecture)
4. [A2UI — Generative UI](#4-a2ui--generative-ui)
5. [Quick Start (Local)](#5-quick-start-local)
6. [Run Tests](#6-run-tests)
7. [Enable Local AI Models](#7-enable-local-ai-models)
8. [Add Your Own Images](#8-add-your-own-images)
9. [Deployment — Render.com](#9-deployment--rendercom)
10. [Deployment — Fly.io](#10-deployment--flyio)
11. [Docker](#11-docker)
12. [Environment Reference](#12-environment-reference)
13. [Repository Structure](#13-repository-structure)
14. [Security Checklist](#14-security-checklist)
15. [Roadmap](#15-roadmap)

---

## 1. What It Does

| Step | Who | What happens |
|------|-----|--------------|
| 1 | Teacher | Creates a **dataset** — a folder of images (science, history, geography…) |
| 2 | Teacher | Opens the dataset and clicks any image |
| 3 | Edge AI | **BLIP** vision model captions the image locally |
| 4 | Local LLM | **TinyLlama** generates curriculum-aligned educational content |
| 5 | A2UI | Backend assembles a **JSON UI schema** from the content |
| 6 | Frontend | **A2UIRenderer** renders the schema as interactive quizzes, flashcards, worksheets |

Everything runs on-premises. Student data never leaves the school network.

---

## 2. UI Overview

### Collapsible sidebar
Persistent left sidebar with navigation to all datasets, live AI engine status (provider, model, latency poll), and user profile. Collapses to icon-only mode.

### Dashboard
- **Welcome hero** with time-of-day greeting
- **Stats row** — datasets, total images, lessons generated, average generation time
- **Dataset cards** with image strip preview (first 3 photos from the folder), subject badge, grade, description
- **Recent Lessons feed** — last 8 lessons with image name, type, timestamp and generation time
- **Tips panel** — quick-start guidance

### Dataset Explorer (two-panel layout)
**Left panel — Image Gallery**
- Grid view (thumbnails) or List view (filenames + metadata) — toggleable
- Live search/filter by filename
- Selected image highlighted with a checkmark overlay
- Image count displayed in header

**Generation Controls** (sticky bottom of left panel, appears when an image is selected):
- Lesson type chips: Full Lesson · Quiz · Flashcards · Worksheet · Vocabulary
- Grade level selector
- **Generate** and **↺ Redo** buttons

**Right panel — AI Output**
- **AI Progress steps** (live, animated) while generating:
  1. Loading image
  2. Identifying image (caption)
  3. Generating content (LLM — longest step)
  4. Building lesson UI
  5. Rendering components
- **Lesson banner** — title, caption, model, time, component count, with Print / Copy-ID / Regenerate actions
- **A2UI rendered lesson** — fully interactive

### Image serving
All images are served through the authenticated API (`/api/v1/datasets/{name}/images/{file}`). For `<img>` tags that can't send headers the token is passed as `?token=…` query param automatically.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────┐
│  React Frontend (Vite + Tailwind)                │
│  A2UIRenderer → QuizBlock / FlashcardBlock /     │
│                 FillBlankBlock / WordBank /       │
│                 ImageAnnotation / ContentBlock    │
└───────────────────┬──────────────────────────────┘
                    │  REST + JWT  (HTTPS)
┌───────────────────▼──────────────────────────────┐
│  FastAPI Backend                                 │
│  /auth  /datasets  /generate                     │
│  ┌────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ image_ai   │ │ llm_service  │ │ a2ui_svc   │ │
│  │ (BLIP)     │ │ (TinyLlama / │ │ JSON schema│ │
│  │            │ │  Ollama /    │ │ assembly   │ │
│  │            │ │  stub)       │ │            │ │
│  └────────────┘ └──────────────┘ └────────────┘ │
│  SQLite (users · datasets · generated_lessons)   │
└───────────────────────────────────────────────────┘
        │                           │
   data/datasets/             models/
   science/                   TinyLlama-1.1B/
   geography/                 blip-base/
   history/  …
```

### Provider fallback chain

Both AI services degrade gracefully so the app is always usable:

```
Image captioning:   BLIP  →  filename heuristic
Content generation: local_transformers  →  Ollama  →  stub (template)
```

The `stub` provider requires zero ML infrastructure and is the default for demos and cloud free-tiers.

---

## 3. A2UI — Generative UI

A2UI is Teacher-Z's internal generative UI protocol.  The LLM backend emits a **versioned JSON document**; the React `A2UIRenderer` turns it into live, interactive components.

### Schema example

```json
{
  "schema_version": "1.0",
  "metadata": { "title": "The Water Cycle", "subject": "science", "grade_level": "5" },
  "layout": { "type": "stack", "gap": "md" },
  "components": [
    { "type": "image_annotation", "props": { "src": "/api/v1/datasets/science/images/water_cycle.png", "annotations": [...] } },
    { "type": "quiz_block",       "props": { "question": "What drives evaporation?", "options": [...], "correct_index": 2 } },
    { "type": "flashcard_block",  "props": { "cards": [{ "front": "Evaporation", "back": "Liquid → Gas" }] } },
    { "type": "fill_blank",       "props": { "template": "Water falls as ___ and collects in ___.", "blanks": [...] } }
  ]
}
```

### Component types

| Type | Interactive |
|------|-------------|
| `content_block` | Heading + body with keyword highlighting |
| `image_annotation` | Clickable dot labels on the image |
| `quiz_block` | MCQ with answer reveal and explanation |
| `flashcard_block` | Flip-card deck with prev/next navigation |
| `fill_blank` | Cloze sentences with inline inputs |
| `word_bank` | Drag-select vocabulary matching |

### Lesson types

Choose the lesson type before generating:

| Type | Components generated |
|------|---------------------|
| `lesson` | Objectives + image + vocabulary + quizzes + discussion |
| `quiz` | Objectives + image + quiz blocks |
| `flashcard` | Image + flip-card deck |
| `worksheet` | Objectives + image + fill-in-blanks + word bank |
| `vocabulary` | Image + flashcards + word bank |

---

## 4. Quick Start (Local)

### Prerequisites

- Python 3.10+
- Node.js 18+
- pip + venv

### A. Backend

```bash
# Clone and enter the repo
git clone <repo-url> Teacher-Z && cd Teacher-Z

# Create virtual environment
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows PowerShell

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Copy environment config
cp .env.example .env
# Default .env uses LLM_PROVIDER=stub (no ML required — great for first run)

# Seed sample images into the dataset folders
python scripts/seed_datasets.py

# Start the API
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

API is now at `http://localhost:8000`

- Swagger UI: http://localhost:8000/docs
- ReDoc:       http://localhost:8000/redoc
- Health:      http://localhost:8000/health

### B. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

App is at **http://localhost:5173**

### C. First login

1. Open http://localhost:5173
2. Click **Create Account** — register with any email + password (≥8 chars)
3. You'll land on the Dashboard showing the pre-seeded datasets
4. Click a dataset (e.g. **Science**), then click any image
5. Choose a lesson type and click **✨ Generate Lesson**

With `LLM_PROVIDER=stub` (default) the lesson generates in <1 second using template content.

---

## 5. Run Tests

```bash
# Activate venv first
source .venv/bin/activate

# Install test extras (already in requirements.txt)
pip install pytest pytest-asyncio

# Run all tests
pytest backend/tests/ -v

# Run a specific test class
pytest backend/tests/test_api.py::TestGenerate -v

# With coverage
pip install pytest-cov
pytest backend/tests/ --cov=backend --cov-report=term-missing
```

Tests use an **in-memory SQLite database** — no setup required. All generation tests run with `stub` provider (no ML models needed).

---

## 6. Enable Local AI Models

### Option A — Ollama (easiest, recommended for local dev)

```bash
# Install Ollama from https://ollama.com
ollama pull tinyllama          # 637 MB

# Edit .env:
LLM_PROVIDER=ollama
OLLAMA_MODEL=tinyllama

# For better quality (requires more RAM):
ollama pull llava              # multimodal vision + text
LLM_PROVIDER=ollama
OLLAMA_MODEL=llava
IMAGE_PROVIDER=stub            # llava handles both image + text in one call
```

### Option B — Transformers (full local inference)

```bash
# Install heavy ML deps (CPU-only torch, ~1 GB download)
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install transformers accelerate

# Pre-download model weights (~2 GB total)
python scripts/download_models.py

# Edit .env:
LLM_PROVIDER=local_transformers
IMAGE_PROVIDER=blip
```

> **Note:** TinyLlama needs ~3 GB RAM for CPU inference. First generation takes ~25 seconds; subsequent ones are faster as models stay in memory.

### Checking model status

```
GET /health
```

```json
{
  "status": "ok",
  "llm_provider": "local_transformers",
  "image_provider": "blip",
  "models_loaded": { "blip": true, "transformers": true }
}
```

---

## 7. Add Your Own Images

Images are files in `data/datasets/{dataset-name}/`.

**Method 1 — Drop files manually:**

```bash
# Any common image format works
cp ~/Downloads/cell_diagram.jpg data/datasets/science/
cp ~/Pictures/ancient_rome/*.png data/datasets/history/
```

**Method 2 — Create a new dataset folder:**

```bash
mkdir -p data/datasets/chemistry
cp *.png data/datasets/chemistry/
```

Then register it in the UI: Dashboard → **+ New Dataset** → folder name = `chemistry`.

**Method 3 — Seed script (placeholder images for testing):**

```bash
python scripts/seed_datasets.py        # colored placeholder PNGs
python scripts/seed_datasets.py --full # download real images from Wikimedia
```

Supported formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`

---

## 8. Deployment — Render.com

The repo includes `render.yaml` for one-click Blueprint deployment.

### Manual setup

1. Push repo to GitHub
2. Render dashboard → **New +** → **Web Service**
3. Connect repository, set branch to `main`

| Setting | Value |
|---------|-------|
| Runtime | Python |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |

4. Set environment variables:

```
SECRET_KEY          = <generate with: python -c "import secrets; print(secrets.token_hex(32))">
ALGORITHM           = HS256
DATABASE_URL        = sqlite:///./teacherz.db
LLM_PROVIDER        = stub
IMAGE_PROVIDER      = stub
CORS_ORIGINS        = https://your-frontend.onrender.com,http://localhost:5173
```

5. **Frontend static site**: New + → Static Site → build command `cd frontend && npm install && npm run build` → publish directory `frontend/dist`

> Free tier instances sleep after 15 min of inactivity. First request after wake-up takes ~10s. Upgrade to Starter ($7/mo) for always-on.

---

## 9. Deployment — Fly.io

```bash
# Install Fly CLI
brew install flyctl       # macOS
# or: curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (creates fly.toml if not present)
fly launch

# Set secrets
fly secrets set SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
fly secrets set ALGORITHM="HS256"
fly secrets set LLM_PROVIDER="stub"
fly secrets set IMAGE_PROVIDER="stub"
fly secrets set CORS_ORIGINS="https://your-app.fly.dev"

# Attach persistent volume for SQLite + datasets
fly volumes create teacherz_data --region iad --size 1

# Deploy
fly deploy

# View logs
fly logs
```

The included `fly.toml` configures 512MB RAM, auto-stop when idle (free tier friendly), and mounts the volume at `/app/data`.

---

## 10. Docker

### Single container

```bash
docker build -t teacher-z .
docker run -p 8000:8000 --env-file .env teacher-z
```

### Docker Compose (recommended for local full-stack)

```bash
# Start backend
docker compose up --build

# With Ollama sidecar (edit docker-compose.yml to uncomment the ollama service)
docker compose --profile ollama up --build
```

### Build with models baked in (for production)

Uncomment the `download_models.py` line in the Dockerfile to bake model weights into the image (~3 GB image, but no cold-start download):

```dockerfile
RUN python scripts/download_models.py
```

---

## 11. Environment Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | (insecure dev key) | JWT signing secret — **change in prod** |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Access token lifetime |
| `DATABASE_URL` | `sqlite:///./teacherz.db` | SQLAlchemy DB URL |
| `CORS_ORIGINS` | localhost origins | Comma-separated allowed origins |
| `DATA_DIR` | `./data` | Root for dataset folders |
| `MODEL_DIR` | `./models` | Root for downloaded model weights |
| `LLM_PROVIDER` | `stub` | `local_transformers` \| `ollama` \| `stub` |
| `IMAGE_PROVIDER` | `stub` | `blip` \| `stub` |
| `LLM_MODEL_NAME` | `TinyLlama/TinyLlama-1.1B-Chat-v1.0` | HuggingFace model ID for local LLM |
| `IMAGE_MODEL_NAME` | `Salesforce/blip-image-captioning-base` | HuggingFace model ID for BLIP |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `tinyllama` | Model name to call in Ollama |
| `ENV` | `development` | `development` \| `production` |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

---

## 12. Repository Structure

```
Teacher-Z/
├── README.md
├── requirements.txt          # Python dependencies
├── .env.example              # Environment template
├── Dockerfile
├── docker-compose.yml
├── fly.toml                  # Fly.io config
├── render.yaml               # Render.com Blueprint
│
├── data/
│   └── datasets/             # Image folders (git-tracked stubs)
│       ├── science/
│       ├── geography/
│       ├── history/
│       └── math/
│
├── models/                   # Downloaded model weights (git-ignored)
│
├── backend/
│   └── app/
│       ├── main.py           # FastAPI app factory
│       ├── core/
│       │   ├── config.py     # Pydantic Settings
│       │   └── security.py   # JWT + password hashing
│       ├── db/
│       │   └── database.py   # SQLAlchemy engine + session
│       ├── models/
│       │   ├── orm.py        # SQLAlchemy models
│       │   └── schemas.py    # Pydantic request/response schemas
│       ├── services/
│       │   ├── image_ai.py   # BLIP image captioning
│       │   ├── llm_service.py # TinyLlama / Ollama content gen
│       │   └── a2ui_service.py # A2UI JSON schema assembly
│       └── api/
│           ├── auth.py       # POST /auth/register, /login, /me
│           ├── datasets.py   # GET/POST /datasets, image serving
│           └── generate.py   # POST /generate, lesson CRUD
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Router + AuthProvider
│   │   ├── types/a2ui.ts     # TypeScript schema types
│   │   ├── lib/api.ts        # Axios client + typed helpers
│   │   ├── components/
│   │   │   ├── A2UIRenderer/ # Generative UI runtime
│   │   │   │   ├── index.tsx
│   │   │   │   └── components/
│   │   │   │       ├── QuizBlock.tsx
│   │   │   │       ├── FlashcardBlock.tsx
│   │   │   │       ├── FillBlankBlock.tsx
│   │   │   │       ├── WordBank.tsx
│   │   │   │       ├── ImageAnnotation.tsx
│   │   │   │       └── ContentBlock.tsx
│   │   │   └── ImageBrowser/ # Dataset image grid
│   │   └── pages/
│   │       ├── Login.tsx
│   │       ├── Dashboard.tsx
│   │       └── DatasetExplorer.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── scripts/
│   ├── seed_datasets.py      # Generate placeholder images
│   └── download_models.py    # Pre-fetch model weights
│
└── backend/tests/
    ├── conftest.py
    └── test_api.py
```

---

## 13. Security Checklist (before onboarding real students)

- [ ] Rotate `SECRET_KEY` and never commit `.env`
- [ ] Enforce HTTPS (Render and Fly handle TLS automatically)
- [ ] Replace SQLite with Postgres for production
- [ ] Add rate limiting on `/generate` (prevents model abuse)
- [ ] Validate MIME types on any file upload endpoints
- [ ] Add RBAC: district admin / school admin / teacher roles
- [ ] Keep student data out of LLM prompts (only image captions)
- [ ] Enable ONNX edge inference for schools with strict data residency
- [ ] Audit log all content generation events

---

## 14. Roadmap

| Priority | Feature |
|----------|---------|
| P1 | File upload endpoint so teachers can add images via UI |
| P1 | Export lesson to PDF / Google Slides |
| P2 | ONNX Runtime edge inference (lighter than transformers) |
| P2 | Postgres + Alembic migrations for production |
| P2 | Multi-tenant school isolation |
| P3 | Stripe billing (Starter / School / District tiers) |
| P3 | CI/CD (GitHub Actions: lint, test, build, deploy) |
| P3 | OpenTelemetry + Sentry observability |
| P4 | Student-facing view with progress tracking |
| P4 | LLM fine-tuning on curriculum standards (Common Core, etc.) |

---

## License

Apache-2.0 — see `LICENSE` for details.
