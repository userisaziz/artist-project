"""Pure article helpers: the excerpt shown on feed cards and the reading time."""

import math

from app.feed.constants import EXCERPT_MAX, WORDS_PER_MINUTE

MARKERS = ("## ", "> ")


def excerpt(body: str) -> str:
    """The first plain paragraph (not a heading or quote), cut at a word to EXCERPT_MAX characters."""
    paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
    first = next((p for p in paragraphs if not p.startswith(MARKERS)), paragraphs[0] if paragraphs else "")
    first = " ".join(first.split())
    if len(first) <= EXCERPT_MAX:
        return first
    return first[:EXCERPT_MAX].rsplit(" ", 1)[0] + "…"


def read_minutes(body: str) -> int:
    return max(1, math.ceil(len(body.split()) / WORDS_PER_MINUTE))
