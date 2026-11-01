"""A small in-process TTL cache — for the answers that cost a database round trip to re-derive.

One value per key, kept fresh for `ttl_seconds`. Expiry is checked when the key is read, so a
value never outlives its window and no background task is needed to forget it. The loader runs
without a lock around it: two misses on the same key may both load, which is cheaper than
single-flight bookkeeping and still leaves every caller with a consistent value.

The cache holds process memory only. Restarting the process forgets it, and each worker keeps
its own copy — fine for reads that tolerate being a few seconds behind the database, which is
exactly what the catalog is. Callers that must see a write at once invalidate through it (see
app.catalog.cache), not by waiting for the window to pass.
"""

import time
from collections.abc import Awaitable, Callable
from typing import Generic, TypeVar

V = TypeVar("V")


class TTLCache(Generic[V]):
    def __init__(self, ttl_seconds: int):
        self.ttl_seconds = ttl_seconds
        self._values: dict[str, tuple[float, V]] = {}

    async def get_or_load(self, key: str, loader: Callable[[], Awaitable[V]]) -> V:
        """The fresh value for `key`, loading it with `loader()` when the window has passed."""
        hit = self._values.get(key)
        now = time.monotonic()
        if hit is not None and hit[0] > now:
            return hit[1]
        value = await loader()
        self._values[key] = (now + self.ttl_seconds, value)
        return value

    def invalidate(self, key: str) -> None:
        """Forget one key; the next read loads it again."""
        self._values.pop(key, None)

    def clear(self) -> None:
        """Forget everything."""
        self._values.clear()
