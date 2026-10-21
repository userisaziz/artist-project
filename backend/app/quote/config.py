"""Enquiry limits. Values apply to new enquiries only."""

from functools import lru_cache

from pydantic import Field

from app.core.config import AppSettings


class QuoteSettings(AppSettings):
    max_open_enquiries_per_customer: int = Field(5, ge=1)  # open or quoted at once, across artists


@lru_cache
def get_quote_settings() -> QuoteSettings:
    return QuoteSettings()
