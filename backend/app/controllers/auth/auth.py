from fastapi import Response

from app.schemas.auth.auth import OTPRequest, OTPVerify, RefreshRequest, TokenPair
from app.schemas.user.user import UserOut
from app.services.auth.auth import AuthService


async def request_otp(body: OTPRequest, service: AuthService) -> Response:
    # 204 regardless of whether the phone exists: no user-enumeration signal.
    await service.request_otp(body.phone)
    return Response(status_code=204)


async def verify_otp(body: OTPVerify, service: AuthService) -> TokenPair:
    user, access, refresh = await service.verify_otp(body.phone, body.code)
    return TokenPair(access_token=access, refresh_token=refresh, user=UserOut.model_validate(user))


async def refresh(body: RefreshRequest, service: AuthService) -> TokenPair:
    user, access, refresh_token = await service.refresh(body.refresh_token)
    return TokenPair(access_token=access, refresh_token=refresh_token, user=UserOut.model_validate(user))
