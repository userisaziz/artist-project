"""Directory support: IST business days counted from the real wall clock (tests move the app's clock with `travel`)."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def ist_day(days: int) -> date:
    return (datetime.now(UTC).astimezone(IST) + timedelta(days=days)).date()


def slot(days: int = 5, hour: int = 11) -> str:
    """An hourly start `days` from today, IST, as the API sends it."""
    d = ist_day(days)
    return datetime(d.year, d.month, d.day, hour, tzinfo=IST).isoformat()
