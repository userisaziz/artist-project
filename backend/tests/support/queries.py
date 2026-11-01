"""Statement counting: a test can assert how many database round trips one request costs.

The database sits hundreds of milliseconds away, so the number of round trips is the latency.
These tests treat it as a contract: `async with count_statements(engine) as statements:` and
then assert on the statements the engine executed while the block ran.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine


@asynccontextmanager
async def count_statements(engine: AsyncEngine) -> AsyncIterator[list[str]]:
    """The SQL the engine executes while the block runs, in order. Empty means no round trip at all."""
    statements: list[str] = []

    def listen(_conn, _cursor, statement, _params, _context, _executemany) -> None:
        statements.append(statement)

    # Async engines fire cursor events on their sync engine — the documented way to watch one.
    event.listen(engine.sync_engine, "before_cursor_execute", listen)
    try:
        yield statements
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", listen)
