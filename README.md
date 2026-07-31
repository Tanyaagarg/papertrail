# PaperTrail 🐾

**PaperTrail watches the "fine print" that quietly rules our lives — Terms of Service,
privacy policies, pricing pages, government notices, rental rules — and tells you, in
plain English, WHAT changed and HOW it affects you.**

You add a page to watch and a short profile about yourself ("I'm a renter", "I use
Stripe"). PaperTrail reads the page, and on each check it either **summarizes the key
points** (first time) or tells you **what meaningfully changed** — using an AI
"semantic diff" (embeddings + a vector database), not a dumb text diff — and explains
the personal impact for *you*.

---

## ✨ Features

- **Add / remove watched pages** with a clean warm-paper dashboard.
- **Plain-English summary** of any page's key points on the first check.
- **Semantic change detection** — catches *meaning* changes, ignores harmless rewording.
- **Personalized impact** — explanations tailored to your profile, written by AI.
- **Background job queue** so checks run without freezing the app.
- **Scheduled crawl** workflow (GitHub Actions cron) ready for once-a-day auto-checks.
- **Validation** (rejects junk URLs) and **duplicate prevention** (no repeated URL/label).
- **Data hygiene** — deleting a page purges its snapshots & vectors for a fresh start.

---

## 🧠 How it works (the flow)

```
You add a URL  ─▶  Backend saves it (MySQL)
Click "Check"  ─▶  Pipeline fetches the page
                    ├─ saves the raw HTML snapshot        (MongoDB)
                    ├─ splits it into clauses             (BeautifulSoup)
                    ├─ turns each clause into an embedding (sentence-transformers)
                    ├─ stores the embeddings              (Qdrant)
                    ├─ compares to the previous version   (semantic diff)
                    └─ writes a summary / impact          (Groq LLM)
Result shows on the dashboard: 📋 Key points / ✅ No changes / 🔔 Change detected
```

---

## 🛠️ Tech stack (and each tool's job)

| Tool | Job in PaperTrail |
|------|-------------------|
| **Next.js + React + TypeScript + Tailwind** | The change-feed dashboard (frontend) |
| **Node.js + Express** | User-facing REST API (users, watched pages, profiles, crawl) |
| **MySQL + Prisma** | Structured data: users, watched sources, profiles |
| **MongoDB** | Raw fetched page snapshots (every version, unstructured) |
| **Redis + BullMQ** | Job queue for background crawl jobs |
| **Python + FastAPI** | The pipeline: fetch, clean, split, embed, diff, explain |
| **sentence-transformers (all-MiniLM-L6-v2)** | Local, free embeddings (no API cost) |
| **Qdrant** | Vector database that powers the semantic diff |
| **Groq (Llama 3.3)** | Free LLM that writes summaries & plain-English impact |
| **Docker Compose** | Runs MySQL, MongoDB, Qdrant, Redis together locally |
| **Git + GitHub + GitHub Actions** | Version control, CI, and a free scheduled cron |

---

## 🌐 Architecture & ports (local)

| Service | Port | Notes |
|---------|------|-------|
| Frontend (Next.js) | `3000` | The dashboard |
| Backend (Express) | `4000` | REST API |
| Pipeline (FastAPI) | `8000` | AI pipeline; docs at `/docs` |
| MySQL | `3306` | via Docker |
| MongoDB | `27018` → 27017 | mapped to **27018** to avoid a native Mongo on 27017 |
| Qdrant | `6333` / `6334` | dashboard at `/dashboard` |
| Redis | `6379` | queue backend |

---

## 📁 Project structure

```
papertrail/
├── docker-compose.yml        # MySQL, MongoDB, Qdrant, Redis
├── .github/workflows/
│   ├── ci.yml                # build/type-check on every push
│   └── scheduled-crawl.yml   # daily cron to trigger crawls
├── backend/                  # Node + Express + Prisma + BullMQ
│   ├── prisma/schema.prisma  # User, Profile, WatchedSource
│   └── src/
│       ├── index.ts          # the API routes
│       ├── worker.ts         # the BullMQ background worker
│       └── lib/{prisma,redis,queue}.ts
├── pipeline/                 # Python + FastAPI (the AI brain)
│   └── app/
│       ├── main.py           # all the endpoints
│       ├── db.py             # MongoDB connection
│       ├── processing.py     # HTML → clean text → clauses
│       ├── embeddings.py     # local embedding model
│       ├── vectors.py        # Qdrant + semantic diff
│       └── explain.py        # Groq summary & explanation
├── frontend/                 # Next.js dashboard
│   └── src/app/{page.tsx,layout.tsx,globals.css}
└── demo/policy.html          # a page you can edit to test change detection
```

---

## ✅ Prerequisites (all free)

- **Node.js** 18+ · **Python** 3.10+ · **Docker Desktop** · **Git** · a free **Groq API key**
- On Windows, Docker needs hardware virtualization ON:
  `bcdedit /set hypervisorlaunchtype auto` then reboot.

---

## 🚀 Getting started (run it locally)

Open **five** terminals (keep each running).

**0. Start Docker Desktop** and wait for "Engine running."

**1. Start the databases** (from the project root):
```bash
docker compose up -d
docker compose ps      # all four should be "Up"
```

**2. Backend API** (`backend/`):
```bash
npm install            # first time only
npx prisma migrate dev # first time only (creates tables)
npm run dev            # http://localhost:4000
```

**3. Background worker** (`backend/`):
```bash
npm run worker
```

**4. Pipeline** (`pipeline/`):
```bash
python -m venv .venv                 # first time only
.venv\Scripts\Activate.ps1           # activate (prompt shows (.venv))
pip install -r requirements.txt      # first time only
uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
```

**5. Frontend** (`frontend/`):
```bash
npm install            # first time only
npm run dev            # http://localhost:3000
```

Open **http://localhost:3000** — the dashboard is live. 🎉

> ⚠️ Each service needs a `.env` file (not committed). See `.env.example` files for the
> keys required. The pipeline needs your `GROQ_API_KEY` in `pipeline/.env`.

---

## 🔑 Environment variables

**Root `.env`** (for Docker): `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`,
`MYSQL_PASSWORD`, `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`.

**`backend/.env`**: `DATABASE_URL` (MySQL), `REDIS_URL`, `PIPELINE_URL`.

**`pipeline/.env`**: `MONGO_URL`, `MONGO_DB`, `QDRANT_URL`, `GROQ_API_KEY`, `GROQ_MODEL`.

**`frontend/.env.local`**: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PIPELINE_URL`.

---

## 📡 API reference (short)

**Backend (Express, :4000)**
- `POST /users` — create a user
- `GET /users` — list users
- `POST /users/:userId/sources` — add a watched page (blocks duplicate url/label)
- `GET /users/:userId/sources` — list watched pages
- `DELETE /users/:userId/sources/:sourceId` — remove a page + purge its data
- `PUT /users/:userId/profile` — set/replace the profile
- `GET /users/:userId/profile` — read the profile
- `POST /users/:userId/crawl` — queue a background check for every watched page

**Pipeline (FastAPI, :8000)**
- `POST /snapshots` — fetch a page, save snapshot, index clauses
- `POST /check` — the main one: returns `first` (summary) / `no_change` / `changed`
- `POST /explain` — diff + personalized explanation
- `POST /diff` — raw semantic diff of the two latest snapshots
- `POST /purge` — delete all snapshots + vectors for a URL
- `POST /debug/*` — clause/similarity/ingest helpers for testing

---

## 🎬 Testing change detection (demo)

Real pages rarely change on demand, so use a page **you** control:
```bash
cd demo
python -m http.server 9000     # serves demo/policy.html
```
Add `http://localhost:9000/policy.html` on the dashboard → **Check** (baseline) →
edit `demo/policy.html` (change a clause) → **Check** again → 🔔 change detected.

---

## ☁️ Deployment (not done yet — on purpose)

The app is **feature-complete and fully working locally**. It is **not deployed** yet
because publishing all six services on free tiers is a large, separate effort:

- Frontend → Vercel, MongoDB → Atlas, Qdrant → Qdrant Cloud, Redis → Upstash,
  MySQL → a free MySQL host, Pipeline (heavy PyTorch model) → Hugging Face Spaces,
  Backend + worker → Render.
- Free tiers "sleep" when idle (cold starts), and the ML pipeline needs more RAM than
  most free web hosts give — so it takes careful, per-service setup.

Everything is deploy-*ready*: env files are templated, and a GitHub Actions cron
(`scheduled-crawl.yml`) is in place to trigger daily crawls once a public backend URL
is set as the `CRAWL_URL` secret.

---

## 🐾 Credit

Built step-by-step as a learning project. Reads the fine print so you don't have to.
