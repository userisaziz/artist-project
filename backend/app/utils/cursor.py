"""Opaque keyset cursors for admin queues ordered by (timestamp, id): new rows never shift pages."""

import base64
import uuid
from datetime import datetime

from app.core.exceptions import ValidationError


def encode_cursor(at: datetime, row_id: uuid.UUID) -> str:
    return base64.urlsafe_b64encode(f"{at.isoformat()}|{row_id}".encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        at, row_id = base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
        return datetime.fromisoformat(at), uuid.UUID(row_id)
    except ValueError as exc:
        raise ValidationError("Invalid cursor") from exc
