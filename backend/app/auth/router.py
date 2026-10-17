from fastapi import APIRouter, Depends, Response

from app.auth.dependencies import get_auth_service, limit_otp_request, limit_otp_verify, limit_refresh
from app.auth.schemas import OTPRequest, OTPVerify, RefreshRequest, TokenPair
from app.auth.service import AuthService
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
async def verify_otp(body: OTPVerify, service: AuthService = Depends(get_auth_service)) -> dict:
    user, access, refresh = await service.verify_otp(body.phone, body.code)
    return {"access_token": access, "refresh_token": refresh, "user": user}


@router.post(
    "/refresh",
    response_model=TokenPair,
    status_code=200,
    summary="Rotate a refresh token",
    description="The old token stops working. Replaying an already-rotated token signs out that whole session.",
    dependencies=[Depends(limit_refresh)],
    responses=errors(401, 422, 429),
)
async def refresh(body: RefreshRequest, service: AuthService = Depends(get_auth_service)) -> dict:
    user, access, refresh_token = await service.refresh(body.refresh_token)
    return {"access_token": access, "refresh_token": refresh_token, "user": user}


@router.post(
    "/logout",
    status_code=204,
    summary="Sign out the session a refresh token belongs to",
    description="Idempotent: unknown or already-revoked tokens also get 204.",
    dependencies=[Depends(limit_refresh)],
    responses=errors(422, 429),
)
async def logout(body: RefreshRequest, service: AuthService = Depends(get_auth_service)) -> Response:
    await service.logout(body.refresh_token)
    return Response(status_code=204)
