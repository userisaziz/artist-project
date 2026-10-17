"""Where "now" comes from. Services receive a `Clock` through the `get_clock` dependency, so tests move
time (booking expiry, slot lead time, refunds, review windows) with `app.dependency_overrides`."""

from datetime import UTC, datetime
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


class FixedClock:
    """Always answers `at`; for tests."""

    def __init__(self, at: datetime):
        self.at = at

    def now(self) -> datetime:
        return self.at


SYSTEM_CLOCK = SystemClock()


def get_clock() -> Clock:
    return SYSTEM_CLOCK
