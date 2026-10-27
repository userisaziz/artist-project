"""Sending pushes. Pushes are queued on the database session by `notify` and handed to the provider only
after the transaction commits (a rolled-back change never notifies). The inbox row is the record; a lost
push is acceptable, so sending is fire-and-forget with a short timeout."""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any, ClassVar

import httpx
from sqlalchemy import delete, event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.notification.config import get_notification_settings
from app.notification.constants import PENDING_PUSH
from app.notification.models import PushDevice

logger = logging.getLogger("art_circle.push")

PushMessage = dict[str, Any]  # {to, title, body, data}
UNREGISTERED = "DeviceNotRegistered"  # Expo's ticket error for an uninstalled app or a revoked token


async def forget_tokens(tokens: list[str]) -> None:
    """Stop pushing to devices Expo says no longer exist. Its own session: this runs after the request's commit."""
    async with SessionLocal() as session:
        await session.execute(delete(PushDevice).where(PushDevice.token.in_(tokens)))
        await session.commit()


def unregistered_tokens(messages: list[PushMessage], body: Any) -> list[str]:
    """Expo answers with one ticket per message, in order."""
    tickets = body.get("data") if isinstance(body, dict) else None
    if not isinstance(tickets, list):
        return []
    return [
        m["to"]
        for m, t in zip(messages, tickets, strict=False)
        if isinstance(t, dict) and t.get("status") == "error" and (t.get("details") or {}).get("error") == UNREGISTERED
    ]


class ConsolePushProvider:
    """Dev and tests: logs and records pushes instead of sending them."""

    sent: ClassVar[list[PushMessage]] = []

    def deliver(self, messages: list[PushMessage]) -> None:
        for m in messages:
            logger.info("push → %s: %s", m["to"], m["title"])
        ConsolePushProvider.sent.extend(messages)


class ExpoPushProvider:
    def __init__(
        self,
        url: str,
        timeout: float,
        transport: httpx.AsyncBaseTransport | None = None,
        forget: Callable[[list[str]], Awaitable[None]] = forget_tokens,
    ):
        self.url, self.timeout, self.transport, self.forget = url, timeout, transport, forget

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
                return
            dead = unregistered_tokens(messages, response.json())
        except (httpx.HTTPError, ValueError) as exc:  # ValueError: a body that isn't JSON
            logger.warning("Expo push failed: %s", exc)
            return
        if dead:
            logger.info("Forgetting %d unregistered push token(s)", len(dead))
            try:
                await self.forget(dead)
            except SQLAlchemyError:  # the next push retries the cleanup
                logger.exception("Could not forget unregistered push tokens")


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
