import os
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION = "clauses"
VECTOR_SIZE = 384  # all-MiniLM-L6-v2 produces 384 numbers per clause

client = QdrantClient(url=QDRANT_URL)


def ensure_collection() -> None:
    """Create our 'clauses' collection once, if it doesn't exist yet."""
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )


def index_clauses(
    url: str,
    snapshot_id: str,
    clauses: list[str],
    vectors: list[list[float]],
) -> int:
    """Store each clause + its embedding as a point in Qdrant."""
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "url": url,
                "snapshot_id": snapshot_id,
                "clause_index": i,
                "text": clause,
            },
        )
        for i, (clause, vector) in enumerate(zip(clauses, vectors))
    ]
    if points:
        client.upsert(collection_name=COLLECTION, points=points)
    return len(points)


# Make sure the collection exists as soon as the app starts.
ensure_collection()

from qdrant_client.models import FieldCondition, Filter, MatchValue


def _snapshot_filter(snapshot_id: str) -> Filter:
    """A filter that limits a search to one snapshot's clauses."""
    return Filter(
        must=[FieldCondition(key="snapshot_id", match=MatchValue(value=snapshot_id))]
    )


def _clause_points(snapshot_id: str):
    """Fetch every clause-point belonging to one snapshot."""
    points, _ = client.scroll(
        collection_name=COLLECTION,
        scroll_filter=_snapshot_filter(snapshot_id),
        with_vectors=True,
        with_payload=True,
        limit=10000,
    )
    return points


def _best_score(vector, snapshot_id: str) -> float:
    """Find the closeness of the nearest clause in the given snapshot."""
    result = client.query_points(
        collection_name=COLLECTION,
        query=vector,
        query_filter=_snapshot_filter(snapshot_id),
        limit=1,
    )
    return result.points[0].score if result.points else 0.0


def compute_diff(current_id: str, previous_id: str, threshold: float = 0.85):
    """Compare two snapshots and return meaningfully added/removed clauses."""
    current_points = _clause_points(current_id)
    previous_points = _clause_points(previous_id)

    # New clauses with NO close match in the old version = added/changed.
    added = []
    for p in current_points:
        score = _best_score(p.vector, previous_id)
        if score < threshold:
            added.append({"text": p.payload["text"], "closest_score": round(float(score), 3)})

    # Old clauses with NO close match in the new version = removed.
    removed = []
    for p in previous_points:
        score = _best_score(p.vector, current_id)
        if score < threshold:
            removed.append({"text": p.payload["text"], "closest_score": round(float(score), 3)})

    return added, removed

from qdrant_client.models import FilterSelector


def purge_url(url: str) -> None:
    """Delete all clause-points for a given URL from Qdrant."""
    client.delete(
        collection_name=COLLECTION,
        points_selector=FilterSelector(
            filter=Filter(
                must=[FieldCondition(key="url", match=MatchValue(value=url))]
            )
        ),
    )