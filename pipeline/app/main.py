from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.db import snapshots

app = FastAPI(title="PaperTrail Pipeline")


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
    # 1) Go fetch the page.
    try:
        response = httpx.get(payload.url, timeout=20, follow_redirects=True)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not fetch that URL")

    # 2) Build the snapshot document (one "folder" for the box).
    doc = {
        "url": payload.url,
        "fetched_at": datetime.now(timezone.utc),
        "status_code": response.status_code,
        "content": response.text,
        "content_length": len(response.text),
    }

    # 3) Save it into MongoDB.
    result = snapshots.insert_one(doc)

    # 4) Reply with the details (but NOT the whole big page).
    return {
        "id": str(result.inserted_id),
        "url": doc["url"],
        "status_code": doc["status_code"],
        "content_length": doc["content_length"],
        "fetched_at": doc["fetched_at"],
    }


# LIST recent snapshots (metadata only, newest first): GET /snapshots
@app.get("/snapshots")
def list_snapshots(limit: int = 10):
    # {"content": 0} means "skip the big content field" so the list stays tidy.
    cursor = snapshots.find({}, {"content": 0}).sort("fetched_at", -1).limit(limit)
    return [serialize(doc) for doc in cursor]