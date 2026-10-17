"""Every error leaves the API in the same `{code, message}` shape, including ones FastAPI raises itself.

422s keep FastAPI's `detail` list alongside, so clients can still point at the offending field.
Unexpected exceptions are handled by `RequestContextMiddleware` (it knows the request id and sits
outside everything else), so they are logged and answered with a generic 500: no internals leak.
"""

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import AppError

HTTP_CODES = {
    400: "bad_request",
    401: "auth_error",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "payload_too_large",
    415: "unsupported_media_type",
    429: "rate_limited",
}


def _error(status: int, code: str, message: str, headers: dict[str, str] | None = None, **extra) -> JSONResponse:
    return JSONResponse({"code": code, "message": message, **extra}, status_code=status, headers=headers)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    # Domain errors become the stable {code, message} contract the client branches on.
    return _error(exc.status_code, exc.code, exc.message, exc.headers, **exc.details)


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = jsonable_encoder(exc.errors(), exclude={"input", "ctx", "url"})  # never echo submitted values
    message = errors[0]["msg"] if errors else "Invalid request"
    return _error(422, "validation_error", message, detail=errors)


async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = HTTP_CODES.get(exc.status_code, "http_error")
    message = exc.detail if isinstance(exc.detail, str) else code.replace("_", " ").capitalize()
    return _error(exc.status_code, code, message, getattr(exc, "headers", None))


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
