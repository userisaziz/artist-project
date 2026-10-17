"""OpenAPI `responses=` entries for the shared `{code, message}` error contract."""

from app.shared.schemas import ErrorResponse

ERROR_DESCRIPTIONS = {
    400: "Bad request",
    401: "Missing, invalid or expired credentials",
    403: "Signed in, but this account may not do this",
    404: "Not found (also for other people's resources)",
    409: "Conflicts with the resource's current state",
    413: "Request body too large",
    422: "Validation failed",
    429: "Too many requests; see Retry-After",
    503: "A dependency is temporarily unavailable",
}


def errors(*statuses: int) -> dict[int | str, dict]:
    return {status: {"model": ErrorResponse, "description": ERROR_DESCRIPTIONS[status]} for status in statuses}
