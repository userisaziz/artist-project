"""Review settings: how long reviews stay open, and phrases that hide a review for moderation."""

from functools import lru_cache

from pydantic import Field

from app.core.config import AppSettings


class ReviewSettings(AppSettings):
    review_window_days: int = Field(30, ge=1)  # open this long after completion
    review_blocked_words: list[str] = ["scam", "fraud", "call me", "whatsapp me"]


@lru_cache
def get_review_settings() -> ReviewSettings:
    return ReviewSettings()
