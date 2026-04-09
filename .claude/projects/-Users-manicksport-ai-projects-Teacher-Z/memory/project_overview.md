---
name: Teacher-Z Project Overview
description: Full SaaS platform for K-12 teachers — image datasets → AI lesson generation → A2UI generative UI
type: project
---

Built from an empty repo (only README) into a complete working platform on 2026-04-10.

**Stack:** FastAPI + SQLAlchemy/SQLite + React 18 + Vite + Tailwind CSS

**AI providers (fallback chain):**
- Image captioning: BLIP (`Salesforce/blip-image-captioning-base`) → filename heuristic
- Content gen: TinyLlama (local_transformers) → Ollama → stub templates
- Default is `stub` (zero ML required) — works on Render/Fly free tier

**A2UI:** Internal generative UI protocol. Backend emits versioned JSON schemas; React A2UIRenderer renders interactive components (QuizBlock, FlashcardBlock, FillBlankBlock, WordBank, ImageAnnotation, ContentBlock).

**Datasets:** Folders of images at `data/datasets/{name}/`. Auth-gated file serving via FastAPI FileResponse.

**Why stub default:** Free tier (Render/Fly) has 256-512MB RAM — can't run TinyLlama (~3GB). Stub gives instant demo; ML providers enabled via env vars.

**bcrypt pin:** Must use `bcrypt==4.0.1` — passlib 1.7.4 is not compatible with bcrypt≥4.1 (strict 72-byte enforcement in its bug-detection routine).

**Tests:** 13 passing, in-memory SQLite, no ML required.
