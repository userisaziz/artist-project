"""Directory support: the IST business-day clock the availability window is computed on."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.shared import clock

IST = ZoneInfo("Asia/Kolkata")


def ist_day(days: int) -> date:
    return (clock.now().astimezone(IST) + timedelta(days=days)).date()


def slot(days: int = 5, hour: int = 11) -> str:
    """An hourly start `days` from today, IST, as the API sends it."""
    d = ist_day(days)
    return datetime(d.year, d.month, d.day, hour, tzinfo=IST).isoformat()
