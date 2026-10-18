from fastapi import APIRouter, Depends, Response

from app.auth.dependencies import (
    get_auth_service,
    limit_otp_request,
    limit_otp_verify,
    limit_refresh,
    presented_refresh_token,
    refresh_cookie,
)
from app.auth.schemas import OTPRequest, OTPVerify, TokenPair
from app.auth.service import AuthService
from app.auth.utils import RefreshCookie
from app.core.exceptions import AuthError
from app.shared.responses import errors

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/otp/request",
    status_code=204,
    summary="Text a one-time sign-in code",
    description="204 whether or not the phone has an account, so the endpoint can't be used to probe numbers.",
    dependencies=[Depends(limit_otp_request)],
    responses=errors(422, 429, 503),
)
async def request_otp(body: OTPRequest, service: AuthService = Depends(get_auth_service)) -> Response:
    await service.request_otp(body.phone)
    return Response(status_code=204)


@router.post(
    "/otp/verify",
    response_model=TokenPair,
    status_code=200,
    summary="Exchange a code for tokens (signs up new numbers)",
    dependencies=[Depends(limit_otp_verify)],
    responses=errors(401, 422, 429),
)
async def verify_otp(
    body: OTPVerify,
    response: Response,
    service: AuthService = Depends(get_auth_service),
    cookie: RefreshCookie | None = Depends(refresh_cookie),
) -> dict:
    user, access, refresh_token = await service.verify_otp(body.phone, body.code)
    return _token_pair(response, cookie, user, access, refresh_token)


@router.post(
    "/refresh",
    response_model=TokenPair,
    status_code=200,
    summary="Rotate a refresh token",
    description=(
        "The old token stops working. Replaying an already-rotated token signs out that whole session. "
        "The token comes from the body, else (only with X-Session-Transport) from the httpOnly cookie."
    ),
    dependencies=[Depends(limit_refresh)],
    responses=errors(401, 422, 429),
)
async def refresh(
    response: Response,
    token: str | None = Depends(presented_refresh_token),
    service: AuthService = Depends(get_auth_service),
    cookie: RefreshCookie | None = Depends(refresh_cookie),
) -> dict:
    try:
        if token is None:
            raise AuthError("No refresh token presented")
        user, access, refresh_token = await service.refresh(token)
    except AuthError as exc:
        if cookie is None:
            raise
        # A dead cookie would fail every later refresh too: drop it with the 401.
        raise AuthError(exc.message, headers={**(exc.headers or {}), **cookie.clearing_headers()}) from exc
    return _token_pair(response, cookie, user, access, refresh_token)


@router.post(
    "/logout",
    status_code=204,
    summary="Sign out the session a refresh token belongs to",
    description=(
        "Idempotent: unknown, already-revoked or missing tokens also get 204. "
        "With X-Session-Transport the httpOnly cookie is always cleared."
    ),
    dependencies=[Depends(limit_refresh)],
    responses=errors(422, 429),
)
async def logout(
    token: str | None = Depends(presented_refresh_token),
    service: AuthService = Depends(get_auth_service),
    cookie: RefreshCookie | None = Depends(refresh_cookie),
) -> Response:
    if token is not None:
        await service.logout(token)
    response = Response(status_code=204)
    if cookie is not None:
        cookie.clear(response)
    return response


def _token_pair(response: Response, cookie: RefreshCookie | None, user, access: str, refresh_token: str) -> dict:
    """Cookie transport: the refresh token goes only into the httpOnly cookie, never the JSON body."""
    if cookie is None:
        return {"access_token": access, "refresh_token": refresh_token, "user": user}
    cookie.set(response, refresh_token)
    return {"access_token": access, "refresh_token": None, "user": user}
