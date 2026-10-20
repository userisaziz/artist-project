"""GET /metrics for the Prometheus scraper. Not part of the public API (hidden from OpenAPI); when
METRICS_TOKEN is set (required in production) the scraper must send it as a bearer token."""

import hmac

from fastapi import APIRouter, Depends, Header, Response

from app.core.config import Settings, get_settings
from app.core.exceptions import AuthError
from app.core.metrics import render

router = APIRouter(tags=["health"], include_in_schema=False)


async def scraper_allowed(authorization: str | None = Header(None), settings: Settings = Depends(get_settings)) -> None:
    if settings.metrics_token is None:
        return
    expected = f"Bearer {settings.metrics_token.get_secret_value()}"
    if not hmac.compare_digest((authorization or "").encode(), expected.encode()):
        raise AuthError("Metrics need the scrape token")


@router.get("/metrics", status_code=200, summary="Prometheus metrics", dependencies=[Depends(scraper_allowed)])
async def metrics() -> Response:
    body, content_type = render()
    return Response(body, media_type=content_type)
