from fastapi import APIRouter, Depends, Response

from app.core.dependencies import get_auth_service
from app.schemas.auth import OTPRequest, OTPVerify, RefreshRequest, TokenPair
from app.schemas.user import UserOut
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/otp/request", status_code=204)
async def request_otp(body: OTPRequest, service: AuthService = Depends(get_auth_service)) -> Response:
    # 204 regardless of whether the phone exists: no user-enumeration signal.
    await service.request_otp(body.phone)
    return Response(status_code=204)


@router.post("/otp/verify", response_model=TokenPair)
async def verify_otp(body: OTPVerify, service: AuthService = Depends(get_auth_service)) -> TokenPair:
    user, access, refresh = await service.verify_otp(body.phone, body.code)
    return TokenPair(access_token=access, refresh_token=refresh, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, service: AuthService = Depends(get_auth_service)) -> TokenPair:
    user, access, refresh_token = await service.refresh(body.refresh_token)
    return TokenPair(access_token=access, refresh_token=refresh_token, user=UserOut.model_validate(user))
