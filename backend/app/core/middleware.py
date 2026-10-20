"""Pure ASGI middleware for the HTTP edge: request ids + access log, security headers, body size limit.

Pure ASGI (not BaseHTTPMiddleware) so streaming and background tasks keep working and the
request id contextvar is visible to every handler and log call.
"""

import logging
import re
import time
import uuid

from starlette.datastructures import MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core import metrics
from app.core.logging import request_id_var

access_logger = logging.getLogger("art_circle.access")
error_logger = logging.getLogger("art_circle.errors")

REQUEST_ID_HEADER = "x-request-id"
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")  # a caller-sent id is kept only if it is harmless

SECURITY_HEADERS = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "strict-transport-security": "max-age=63072000; includeSubDomains",
    "cross-origin-opener-policy": "same-origin",
}
# The API serves JSON only; the docs pages (local/staging) load Swagger assets from a CDN, so they're exempt.
API_CSP = "default-src 'none'; frame-ancestors 'none'"
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


class RequestContextMiddleware:
    """Gives each request an id (echoed in X-Request-ID and every log line), writes one access log line,
    and turns any exception that escaped the app into the generic 500 contract: logged, nothing leaked."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        sent = dict(scope["headers"]).get(REQUEST_ID_HEADER.encode(), b"").decode("latin-1")
        request_id = sent if _SAFE_REQUEST_ID.match(sent) else uuid.uuid4().hex
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        status = 500
        response_started = False

        async def send_with_id(message: Message) -> None:
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                status = message["status"]
                response_started = True
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            error_logger.exception("Unhandled error on %s %s", scope["method"], scope["path"])
            if not response_started:
                body = {
                    "code": "internal_error",
                    "message": "Something went wrong on our side.",
                    "request_id": request_id,
                }
                await JSONResponse(body, status_code=500)(scope, receive, send_with_id)
        finally:
            elapsed = time.perf_counter() - started
            route = scope.get("route")
            metrics.observe(scope["method"], getattr(route, "path_format", None), status, elapsed)
            client = scope.get("client")
            access_logger.info(
                "%s %s %s",
                scope["method"],
                scope["path"],
                status,
                extra={
                    "method": scope["method"],
                    "path": scope["path"],
                    "status": status,
                    "duration_ms": round(elapsed * 1000, 1),
                    "client_ip": client[0] if client else None,
                },
            )
            request_id_var.reset(token)


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        is_docs = scope["path"].startswith(DOCS_PATHS)

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in SECURITY_HEADERS.items():
                    headers.setdefault(name, value)
                if not is_docs:
                    headers.setdefault("content-security-policy", API_CSP)
                    headers.setdefault("cache-control", "no-store")
            await send(message)

        await self.app(scope, receive, send_with_headers)


class BodySizeLimitMiddleware:
    """413 for request bodies over `max_bytes`, whether announced by Content-Length or streamed."""

    def __init__(self, app: ASGIApp, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        declared = dict(scope["headers"]).get(b"content-length")
        if declared is not None and declared.isdigit() and int(declared) > self.max_bytes:
            await _too_large(scope, receive, send)
            return
        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _BodyTooLarge
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _BodyTooLarge:
            if not response_started:
                await _too_large(scope, receive, send)


class _BodyTooLarge(Exception):
    pass


async def _too_large(scope: Scope, receive: Receive, send: Send) -> None:
    response = JSONResponse({"code": "payload_too_large", "message": "Request body is too large"}, status_code=413)
    await response(scope, receive, send)
