"""Keyset paging on (timestamp, id): new rows never shift pages. Cursors are opaque (see cursor.py)."""

import uuid
from collections.abc import Callable, Sequence
from datetime import datetime
from typing import Any, TypeVar

from sqlalchemy import ColumnElement, Select, and_, or_
from sqlalchemy.orm import InstrumentedAttribute

from app.shared.cursor import decode_cursor, encode_cursor

T = TypeVar("T")


def keyset(
    query: Select,
    column: ColumnElement[Any] | InstrumentedAttribute[Any],
    id_column: ColumnElement[Any] | InstrumentedAttribute[Any],
    *,
    descending: bool,
    cursor: str | None,
) -> Select:
    """Order by (column, id) and continue after `cursor`."""
    if cursor:
        at, row_id = decode_cursor(cursor)
        after = (
            or_(column < at, and_(column == at, id_column < row_id))
            if descending
            else or_(column > at, and_(column == at, id_column > row_id))
        )
        query = query.where(after)
    order = (column.desc(), id_column.desc()) if descending else (column.asc(), id_column.asc())
    return query.order_by(*order)


def split_page(
    rows: Sequence[T], limit: int, key: Callable[[T], tuple[datetime, uuid.UUID]]
) -> tuple[list[T], str | None]:
    """`rows` was fetched with `limit + 1`: the page, and a cursor to the next one when there is more."""
    page = list(rows[:limit])
    if len(rows) <= limit:
        return page, None
    return page, encode_cursor(*key(page[-1]))
