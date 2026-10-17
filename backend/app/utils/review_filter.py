"""Pure review rules: the auto-filter that hides a review for moderation, and the 30-day review window."""

import re
from datetime import datetime, timedelta

from app.core.config import get_settings

CONTACT_PATTERNS = (
    re.compile(r"(?<!\d)(?:\+?\d[\s-]?){10,}"),  # phone numbers, +91 or not, spaces or dashes; any 10+ digit run
    re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),  # emails
    re.compile(r"(?<![\w.])@[A-Za-z0-9_.]{2,}"),  # @handles
    re.compile(r"https?://|\bwww\.", re.IGNORECASE),  # links
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
