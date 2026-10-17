"""Security audit trail: one structured log line per security-relevant event (sign-ins, token misuse,
admin changes). Lines go to the `art_circle.audit` logger, so they can be shipped and retained apart
from ordinary application logs. Never pass secrets; phone numbers are masked."""

import logging

audit_logger = logging.getLogger("art_circle.audit")


def mask_phone(phone: str) -> str:
    """+919845012345 -> +91******2345: enough to correlate, not enough to contact."""
    return phone[:3] + "*" * max(len(phone) - 7, 0) + phone[-4:]


def audit(event: str, **fields: object) -> None:
    audit_logger.info(event, extra={"event": event, **fields})
