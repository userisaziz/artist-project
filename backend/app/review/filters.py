"""Pure review rules: the auto-filter that hides a review for moderation, and the 30-day review window."""

import re
from datetime import datetime, timedelta

from app.core.config import get_settings

# Phone-shaped groups only, so dates ("15-10-2026 11:00") and lists of prices don't trip the filter.
CONTACT_PATTERNS = (
    re.compile(r"(?<![\d-])(?:\+?91[\s.-]?)?\(?[6-9]\d{4}\)?[\s.-]?\d{5}(?!\d)"),  # Indian mobiles: 98450 67890, (98450) 12345
    re.compile(r"\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b"),  # other 3-3-4 numbers: (555) 123-4567
    re.compile(r"\d{10,}"),  # any long unbroken digit run
    re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),  # emails
    re.compile(r"(?<![\w.])@[A-Za-z0-9_.]{2,}"),  # @handles
    re.compile(r"https?://|\bwww\.|\b[\w-]+\.(?:com|in|me|co|net|org|io|app|link)\b", re.IGNORECASE),  # links, bare domains
)


def review_flag(text: str | None) -> str | None:
    """`contact_info`, `blocked_word`, or None when the review can publish straight away."""
    if not text:
        return None
    if any(p.search(text) for p in CONTACT_PATTERNS):
        return "contact_info"
    for phrase in get_settings().review_blocked_words:
        if re.search(rf"\b{re.escape(phrase)}\b", text, re.IGNORECASE):
            return "blocked_word"
    return None


def review_window_open(completed_at: datetime | None, now: datetime) -> bool:
    if completed_at is None:
        return False
    return now - completed_at <= timedelta(days=get_settings().review_window_days)
