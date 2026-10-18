"""Request allowances for the sign-in endpoints (fixed windows, see app.core.rate_limit)."""

from enum import StrEnum

from app.core.rate_limit import Limit

OTP_REQUEST_PER_IP = Limit(hits=10, window_seconds=600)
OTP_REQUEST_PER_PHONE = Limit(hits=5, window_seconds=3600)  # SMS costs money: cap texts per number
OTP_VERIFY_PER_IP = Limit(hits=30, window_seconds=600)
OTP_VERIFY_PER_PHONE = Limit(hits=10, window_seconds=600)  # on top of the per-code attempt lockout
REFRESH_PER_IP = Limit(hits=60, window_seconds=600)

# Refresh-token transport for browsers: an httpOnly cookie instead of a token the page's JS can read.
# The client opts in with the header; requiring it on cookie reads forces a CORS preflight (CSRF guard).
SESSION_TRANSPORT_HEADER = "X-Session-Transport"
REFRESH_COOKIE_NAME = "ac_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"  # only the auth endpoints ever see the cookie
INSECURE_COOKIE_ENVIRONMENTS = ("local", "test")  # plain-http dev servers; Secure everywhere else


class SessionTransport(StrEnum):
    COOKIE = "cookie"  # persistent: survives a browser restart until the refresh token expires
    COOKIE_SESSION = "cookie-session"  # dies with the browser session ("don't remember me")
