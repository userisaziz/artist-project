"""Pluggable SMS delivery — one seam between our auth logic and the outside world.

Console for tests (records sends so tests can read the code), Fast2SMS for real
delivery. Another gateway later is one new class + one new settings value.
"""

import logging
from abc import ABC, abstractmethod
from typing import ClassVar

import httpx

from app.core.config import get_settings

logger = logging.getLogger("art_circle.sms")


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
        api_key = get_settings().fast2sms_api_key
        if not api_key:
            raise RuntimeError("SMS_PROVIDER=fast2sms but FAST2SMS_API_KEY is empty")
        digits = "".join(c for c in phone if c.isdigit())
        number = digits[2:] if len(digits) == 12 and digits.startswith("91") else digits
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                self.URL,
                headers={"authorization": api_key},
                json={"route": "otp", "variables_values": code, "numbers": number},
            )
        payload = response.json() if response.content else {}
        if response.status_code != 200 or not payload.get("success"):
            raise RuntimeError(f"Fast2SMS send failed ({response.status_code}): {payload}")


def get_sms_provider() -> SMSProvider:
    name = get_settings().sms_provider
    if name == "console":
        return ConsoleSMSProvider()
    if name == "fast2sms":
        return Fast2SMSProvider()
    raise ValueError(f"Unknown SMS_PROVIDER: {name!r} (supported: console, fast2sms)")
