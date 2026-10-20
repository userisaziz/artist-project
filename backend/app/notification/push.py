"""Sending pushes. Pushes are queued on the database session by `notify` and handed to the provider only
after the transaction commits (a rolled-back change never notifies). The inbox row is the record; a lost
push is acceptable, so sending is fire-and-forget with a short timeout."""

import asyncio
import logging
from typing import Any, ClassVar

import httpx
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.notification.config import get_notification_settings
from app.notification.constants import PENDING_PUSH

logger = logging.getLogger("art_circle.push")

PushMessage = dict[str, Any]  # {to, title, body, data}


class ConsolePushProvider:
    """Dev and tests: logs and records pushes instead of sending them."""

    sent: ClassVar[list[PushMessage]] = []

    def deliver(self, messages: list[PushMessage]) -> None:
        for m in messages:
            logger.info("push → %s: %s", m["to"], m["title"])
        ConsolePushProvider.sent.extend(messages)


class ExpoPushProvider:
    def __init__(self, url: str, timeout: float, transport: httpx.AsyncBaseTransport | None = None):
        self.url, self.timeout, self.transport = url, timeout, transport

    _tasks: ClassVar[set[asyncio.Task]] = set()  # keeps in-flight sends alive until they finish

    def deliver(self, messages: list[PushMessage]) -> None:
        task = asyncio.get_running_loop().create_task(self._send(messages))
        ExpoPushProvider._tasks.add(task)
        task.add_done_callback(ExpoPushProvider._tasks.discard)

    async def _send(self, messages: list[PushMessage]) -> None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, transport=self.transport) as client:
                response = await client.post(self.url, json=messages)
            if response.status_code >= 400:
                logger.warning("Expo push failed (%s): %s", response.status_code, response.text[:300])
        except httpx.HTTPError as exc:
            logger.warning("Expo push failed: %s", exc)


def get_push_provider() -> ConsolePushProvider | ExpoPushProvider:
    s = get_notification_settings()
    if s.push_provider == "expo":
        return ExpoPushProvider(s.expo_push_url, s.push_timeout_seconds)
    return ConsolePushProvider()


@event.listens_for(Session, "after_commit")
def _send_pending(session: Session) -> None:
    messages = session.info.pop(PENDING_PUSH, None)
    if messages:
        get_push_provider().deliver(messages)


@event.listens_for(Session, "after_rollback")
def _drop_pending(session: Session) -> None:
    session.info.pop(PENDING_PUSH, None)
