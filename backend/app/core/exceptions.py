"""Domain errors — each maps to a stable JSON contract {code, message} + status.

The mobile client branches on `code`, never on `message`, so these strings are
API contract: change them only together with the client.
"""


class AppError(Exception):
    status_code = 500
    code = "internal_error"
    message = "Internal server error"

    def __init__(self, message: str | None = None, **details):
        self.message = message or self.__class__.message
        self.details = details  # extra body fields, e.g. submit's `missing` list
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code, code, message = 404, "not_found", "Resource not found"


class AuthError(AppError):
    status_code, code, message = 401, "auth_error", "Authentication failed"


class ConflictError(AppError):
    status_code, code, message = 409, "conflict", "Resource conflict"


class RateLimitError(AppError):
    status_code, code, message = 429, "rate_limited", "Too many requests"


class ForbiddenError(AppError):
    status_code, code, message = 403, "forbidden", "Not allowed for this account"


class ValidationError(AppError):
    status_code, code, message = 422, "validation_error", "Invalid request"
