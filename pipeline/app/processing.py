import re

from bs4 import BeautifulSoup


def extract_text(html: str) -> str:
    """Turn a raw HTML page into clean, human-readable text."""
    soup = BeautifulSoup(html, "html.parser")

    # Throw away code-only tags that hold no readable words.
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    # Get the visible text, then tidy up blank lines and spacing.
    text = soup.get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def split_into_clauses(text: str) -> list[str]:
    """Cut clean text into clauses (chunks of meaning)."""
    # Split at sentence-enders (. ! ?) and at line breaks.
    rough_pieces = re.split(r"(?<=[.!?])\s+|\n+", text)

    # Keep only pieces that are long enough to carry real meaning
    # (this skips tiny bits like menu links or single words).
    clauses = [piece.strip() for piece in rough_pieces if len(piece.strip()) >= 40]
    return clauses