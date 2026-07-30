# PaperTrail 🐾

PaperTrail watches the **fine print** that quietly rules our lives — Terms of
Service, privacy policies, pricing pages, government notices, rental rules — and
tells you, in plain English, **what changed** and **how it affects you**.

You add a page to watch and a short profile about yourself
(e.g. "I'm a renter", "I use Stripe"). On a schedule, PaperTrail re-fetches each
page, figures out what *meaningfully* changed using AI embeddings (a "semantic
diff"), and explains the impact in a clean change feed.

## Tech stack
- **Frontend:** Next.js + React + TypeScript + Tailwind
- **Backend:** Node.js + Express (REST API)
- **Database:** MySQL + Prisma (structured data)
- **Snapshots:** MongoDB (raw fetched page versions)
- **Queue & cache:** Redis + BullMQ
- **Pipeline:** Python + FastAPI (fetch, split, embed, diff)
- **Vector DB:** Qdrant (clause embeddings → semantic diff)
- **AI:** Groq (plain-English explanations)
- **Infra:** Docker Compose, GitHub Actions (CI + scheduled crawls)

## Status
🚧 Early development — building the MVP one milestone at a time.