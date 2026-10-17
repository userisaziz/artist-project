from fastapi import APIRouter, Depends, Response

from app.controllers.auth import auth as controller
from app.controllers.auth.dependencies import get_auth_service
from app.schemas.auth.auth import OTPRequest, OTPVerify, RefreshRequest, TokenPair
from app.services.auth.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/otp/request", status_code=204)
async def request_otp(body: OTPRequest, service: AuthService = Depends(get_auth_service)) -> Response:
    return await controller.request_otp(body, service)


@router.post("/otp/verify", response_model=TokenPair)
async def verify_otp(body: OTPVerify, service: AuthService = Depends(get_auth_service)) -> TokenPair:
    return await controller.verify_otp(body, service)


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, service: AuthService = Depends(get_auth_service)) -> TokenPair:
    return await controller.refresh(body, service)
