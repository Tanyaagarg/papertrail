from datetime import datetime, timezone
from app.vectors import index_clauses, compute_diff
from app.embeddings import embed_texts
from app.processing import extract_text, split_into_clauses
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.db import snapshots
from app.explain import explain_changes
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="PaperTrail Pipeline")

# Let the Next.js dashboard (port 3000) call this pipeline.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Describes the data we expect when someone asks us to snapshot a page.
class SnapshotRequest(BaseModel):
    url: str


def serialize(doc):
    """Turn a Mongo document into something JSON-friendly."""
    doc["id"] = str(doc.pop("_id"))
    return doc


@app.get("/health")
def health():
    return {"status": "ok", "service": "papertrail-pipeline"}


@app.get("/")
def home():
    return {"message": "PaperTrail pipeline is alive! 🐍"}


# FETCH a page and SAVE a snapshot: POST /snapshots  with body { "url": "..." }
@app.post("/snapshots")
def create_snapshot(payload: SnapshotRequest):
    # 1) Fetch the page.
    try:
        response = httpx.get(payload.url, timeout=20, follow_redirects=True)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not fetch that URL")

    # 2) Save the raw snapshot into MongoDB.
    doc = {
        "url": payload.url,
        "fetched_at": datetime.now(timezone.utc),
        "status_code": response.status_code,
        "content": response.text,
        "content_length": len(response.text),
    }
    result = snapshots.insert_one(doc)
    snapshot_id = str(result.inserted_id)

    # 3) Clean → split into clauses → embed → store in Qdrant.
    text = extract_text(response.text)
    clauses = split_into_clauses(text)
    indexed = 0
    if clauses:
        vectors = embed_texts(clauses)
        indexed = index_clauses(payload.url, snapshot_id, clauses, vectors)

    # 4) Reply with the details.
    return {
        "id": snapshot_id,
        "url": doc["url"],
        "status_code": doc["status_code"],
        "content_length": doc["content_length"],
        "clauses_indexed": indexed,
        "fetched_at": doc["fetched_at"],
    }

# LIST recent snapshots (metadata only, newest first): GET /snapshots
@app.get("/snapshots")
def list_snapshots(limit: int = 10):
    # {"content": 0} means "skip the big content field" so the list stays tidy.
    cursor = snapshots.find({}, {"content": 0}).sort("fetched_at", -1).limit(limit)
    return [serialize(doc) for doc in cursor]


# DEBUG: fetch a page, clean it, and show the clauses we'd compare.
@app.post("/debug/clauses")
def debug_clauses(payload: SnapshotRequest):
    response = httpx.get(payload.url, timeout=20, follow_redirects=True)
    text = extract_text(response.text)
    clauses = split_into_clauses(text)
    return {
        "url": payload.url,
        "clause_count": len(clauses),
        "clauses": clauses[:20],  # show the first 20 so the reply stays readable
    }


# A little form for comparing two sentences' meanings.
class SimilarityRequest(BaseModel):
    text_a: str
    text_b: str


# DEBUG: how similar in MEANING are two sentences? (1.0 = identical meaning)
@app.post("/debug/similarity")
def debug_similarity(payload: SimilarityRequest):
    vectors = embed_texts([payload.text_a, payload.text_b])
    a, b = vectors[0], vectors[1]

    # Because the vectors are normalized, closeness = the dot product.
    similarity = sum(x * y for x, y in zip(a, b))

    return {
        "text_a": payload.text_a,
        "text_b": payload.text_b,
        "similarity": round(similarity, 3),
        "dimensions": len(a),
    }

# --- A helper to inject test versions of a page (plain text, no fetching) ---
class IngestRequest(BaseModel):
    url: str
    text: str


@app.post("/debug/ingest")
def debug_ingest(payload: IngestRequest):
    """Store a snapshot from raw text (handy for testing the diff)."""
    doc = {
        "url": payload.url,
        "fetched_at": datetime.now(timezone.utc),
        "status_code": 200,
        "content": payload.text,
        "content_length": len(payload.text),
    }
    result = snapshots.insert_one(doc)
    snapshot_id = str(result.inserted_id)

    clauses = split_into_clauses(payload.text)
    indexed = 0
    if clauses:
        indexed = index_clauses(payload.url, snapshot_id, clauses, embed_texts(clauses))

    return {"id": snapshot_id, "url": payload.url, "clauses_indexed": indexed}


# --- The real semantic diff: compare a URL's two most recent snapshots ---
class DiffRequest(BaseModel):
    url: str


@app.post("/diff")
def semantic_diff(payload: DiffRequest):
    recent = list(
        snapshots.find({"url": payload.url}).sort("fetched_at", -1).limit(2)
    )
    if len(recent) < 2:
        return {
            "url": payload.url,
            "message": "Need at least two snapshots of this URL to compare.",
            "added_or_changed": [],
            "removed": [],
        }

    current_id = str(recent[0]["_id"])   # newest
    previous_id = str(recent[1]["_id"])  # the one before

    added, removed = compute_diff(current_id, previous_id)

    return {
        "url": payload.url,
        "current_snapshot": current_id,
        "previous_snapshot": previous_id,
        "added_or_changed": added,
        "removed": removed,
    }


class ExplainRequest(BaseModel):
    url: str
    profile: str | None = None


@app.post("/explain")
def explain(payload: ExplainRequest):
    recent = list(
        snapshots.find({"url": payload.url}).sort("fetched_at", -1).limit(2)
    )
    if len(recent) < 2:
        return {
            "url": payload.url,
            "message": "Need at least two snapshots to compare.",
            "explanation": None,
        }

    current_id = str(recent[0]["_id"])
    previous_id = str(recent[1]["_id"])
    added, removed = compute_diff(current_id, previous_id)

    explanation = explain_changes(payload.url, payload.profile, added, removed)

    return {
        "url": payload.url,
        "added_or_changed": added,
        "removed": removed,
        "explanation": explanation,
    }