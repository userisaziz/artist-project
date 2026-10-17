"""Pluggable SMS delivery — one seam between our auth logic and the outside world.

Console for tests and local dev (records sends so tests can read the code; refused in production
by AuthSettings), Fast2SMS for real delivery. Another gateway later is one new class + one new
settings value. Any delivery failure surfaces as 503 `service_unavailable`, never a raw 500.
"""

import logging
from abc import ABC, abstractmethod
from typing import ClassVar

import httpx

from app.auth.config import get_auth_settings
from app.core.audit import mask_phone
from app.core.exceptions import ServiceUnavailableError

logger = logging.getLogger("art_circle.sms")

SMS_FAILED = "We couldn't send the code right now. Please try again in a minute."


class SMSProvider(ABC):
    @abstractmethod
    async def send_otp(self, phone: str, code: str) -> None: ...


class ConsoleSMSProvider(SMSProvider):
    """Test/dev-mode provider: logs the OTP and records it so tests can read it."""

    sent: ClassVar[list[tuple[str, str]]] = []

    async def send_otp(self, phone: str, code: str) -> None:
        message = f"Your Art Circle code is {code}"
        logger.info("[console-sms] to=%s | %s", phone, message)
        ConsoleSMSProvider.sent.append((phone, message))


class Fast2SMSProvider(SMSProvider):
    """Real delivery via Fast2SMS OTP route.

    The OTP template is fixed server-side ("Your OTP: {var}"), so we send the
    numeric code only — never a custom message. Fast2SMS wants 10-digit Indian
    mobiles, so the +91 country code is stripped before posting.
    """

    URL = "https://www.fast2sms.com/dev/bulkV2"

    async def send_otp(self, phone: str, code: str) -> None:
        settings = get_auth_settings()
        digits = "".join(c for c in phone if c.isdigit())
        number = digits[2:] if len(digits) == 12 and digits.startswith("91") else digits
        try:
            async with httpx.AsyncClient(timeout=settings.sms_timeout_seconds) as client:
                response = await client.post(
                    self.URL,
                    headers={"authorization": settings.fast2sms_api_key.get_secret_value()},
                    json={"route": "otp", "variables_values": code, "numbers": number},
                )
            payload = response.json() if response.content else {}
        except (httpx.HTTPError, ValueError) as exc:
            logger.error("Fast2SMS unreachable for %s: %s", mask_phone(phone), exc.__class__.__name__)
            raise ServiceUnavailableError(SMS_FAILED) from exc
        if response.status_code != 200 or not payload.get("success"):
            reason = payload.get("message") if isinstance(payload, dict) else None  # only the reason, not the request
            logger.error("Fast2SMS refused %s (%s): %s", mask_phone(phone), response.status_code, reason)
            raise ServiceUnavailableError(SMS_FAILED)


def get_sms_provider() -> SMSProvider:
    name = get_auth_settings().sms_provider
    if name == "console":
        return ConsoleSMSProvider()
    return Fast2SMSProvider()
