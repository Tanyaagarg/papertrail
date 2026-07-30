from sentence_transformers import SentenceTransformer

# Load the free, local model once when the app starts.
# The FIRST time this runs, it downloads the model (~90 MB) automatically.
_model = SentenceTransformer("all-MiniLM-L6-v2")


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Turn a list of texts into a list of meaning-coordinates (embeddings)."""
    vectors = _model.encode(texts, normalize_embeddings=True)
    return vectors.tolist()