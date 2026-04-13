# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

An auto shop management system with:
- **Backend**: FastAPI + PostgreSQL, serving a REST API at `http://localhost:8000/api/v1`
- **Frontend**: React Native (Expo) mobile app targeting iOS/Android

---

## Backend

### Running the Backend

```bash
cd backend
source ../venv/bin/activate  # or freshvenv/bin/activate
python3 main.py
```

API docs available at `http://localhost:8000/docs`.

### Required Environment Variables

Create a `.env` file in the repo root (loaded by `main.py` via `python-dotenv`):

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/autoshop
OPENAI_API_KEY=...
JWT_SECRET_KEY=...  # Must be ≥32 chars and not the default dev value
UPLOAD_DIR=./uploads
INVOICE_DIR=./invoices
CORS_ORIGINS=http://localhost:8081,http://localhost:19006
```

Startup will exit if `OPENAI_API_KEY`, `JWT_SECRET_KEY`, or `DATABASE_URL` are missing or if `JWT_SECRET_KEY` is weak.

### Dependency Management

Dependencies are managed with `pip-compile`:
- Edit `requirements.in` to add/change packages
- Run `pip-compile requirements.in` to regenerate `requirements.txt`
- Install with `pip install -r requirements.txt`

### Architecture

The backend follows a layered pattern:

- **`main.py`** — App entry point; registers routers, configures CORS/rate-limiting, validates env, calls `init_db()`
- **`api/`** — FastAPI routers (`*_routes.py`), Pydantic request/response models (`models.py`), auth middleware (`auth_dependencies.py`), rate limiter (`rate_limit.py`)
- **`database/db.py`** — SQLAlchemy ORM models (`UserDB`, `CustomerDB`, `VehicleDB`, `WorkOrderDB`, `ShopSettingsDB`) and `init_db()` which auto-creates tables on startup
- **`database/repos.py`** — Repository classes (`UserRepository`, etc.) with static CRUD methods; routes call repos, not the ORM directly
- **`services/`** — Business logic and external integrations:
  - `auth.py` — JWT creation/verification, password hashing
  - `audio.py` — OpenAI Whisper transcription
  - `image.py` — GPT-4o vision for VIN and odometer extraction
  - `generate.py` — GPT-4o work summary generation from transcripts
  - `vin_decoder.py` — NHTSA VIN lookup
  - `invoice.py` + `invoice_generator_html.py` — Invoice/estimate generation (HTML → PDF via ReportLab)

Authentication uses JWT Bearer tokens. All routes (except `/api/v1/auth/token` and `/api/v1/auth/register`) require a valid token via `get_current_user` dependency in `auth_dependencies.py`.

---

## Frontend

### Running the Frontend

```bash
cd frontend
npm install        # first time
npx expo start     # starts Metro bundler
```

- iOS Simulator: `npx expo run:ios`
- Android Emulator: `npx expo run:android`

### Linting and Tests

```bash
cd frontend
npm run lint       # expo lint
npm test           # jest-expo (interactive watch mode)
npm test -- --watchAll=false  # single run
```

### API URL Configuration

The base URL is configured in `app/api/client.ts`. In development, iOS uses `http://192.168.0.89:8000/api/v1` (a hardcoded LAN IP) and Android uses `http://10.0.2.2:8000/api/v1`. Update the iOS URL if your machine's IP changes.

### Architecture

- **`app/_layout.tsx`** — Root layout; wraps everything in `AppThemeProvider` → `ThemeProvider` → `AuthProvider` → `AuthCheck`. `AuthCheck` handles redirect logic: unauthenticated users go to `/auth/login`, authenticated users in the auth group go to `/`.
- **`app/(tabs)/`** — Tab screens: `index.tsx` (home), `customers.tsx`, `workorders.tsx`, `invoices.tsx`, `more.tsx`
- **`app/api/`** — API layer; `client.ts` exports `api` helper with `get/post/put/delete/upload` methods that automatically attach the JWT from `SecureStore`. Domain-specific modules (`customers.ts`, `vehicles.ts`, `workorders.ts`, `invoices.ts`, `shop.ts`) call `client.ts`.
- **`app/context/AuthContext.tsx`** — Manages auth state; stores JWT in `expo-secure-store`. Validates token on startup by calling `/auth/me`.
- **`app/context/ThemeContext.tsx`** — Theme (light/dark) management.
- Deep-link routes like `app/customers/[id].tsx`, `app/workorders/[id].tsx` handle detail and edit views.
