"""Request allowances for the sign-in endpoints (fixed windows, see app.core.rate_limit)."""

from app.core.rate_limit import Limit

OTP_REQUEST_PER_IP = Limit(hits=10, window_seconds=600)
OTP_REQUEST_PER_PHONE = Limit(hits=5, window_seconds=3600)  # SMS costs money: cap texts per number
OTP_VERIFY_PER_IP = Limit(hits=30, window_seconds=600)
OTP_VERIFY_PER_PHONE = Limit(hits=10, window_seconds=600)  # on top of the per-code attempt lockout
REFRESH_PER_IP = Limit(hits=60, window_seconds=600)
