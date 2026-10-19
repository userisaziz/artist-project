import uuid

from fastapi import APIRouter, Depends, Response

from app.core.auth import audited_admin
from app.platform.dependencies import get_platform_service
from app.platform.schemas import AddAdminIn, City, Policy, TeamMember
from app.platform.service import PlatformService
from app.shared.responses import errors
from app.user.models import User

router = APIRouter(
    prefix="/admin/settings",
    tags=["admin settings"],
    dependencies=[Depends(audited_admin)],
    responses=errors(401, 403, 404, 409, 422),
)


@router.get("/policies", response_model=list[Policy], status_code=200, summary="Booking rules (read-only)")
async def list_policies(platform: PlatformService = Depends(get_platform_service)) -> list[dict]:
    return platform.policies()


@router.get("/cities", response_model=list[City], status_code=200, summary="Live cities with artist counts")
async def list_cities(platform: PlatformService = Depends(get_platform_service)) -> list[dict]:
    return await platform.cities()


@router.get("/team", response_model=list[TeamMember], status_code=200, summary="Admins, earliest first")
async def list_team(
    me: User = Depends(audited_admin), platform: PlatformService = Depends(get_platform_service)
) -> list[dict]:
    return await platform.team(me)


@router.post("/team", response_model=TeamMember, status_code=201, summary="Give an account admin access")
async def add_admin(
    body: AddAdminIn, me: User = Depends(audited_admin), platform: PlatformService = Depends(get_platform_service)
) -> dict:
    return await platform.add_admin(me, body.phone)


@router.delete("/team/{user_id}", status_code=204, summary="Remove admin access", response_class=Response)
async def remove_admin(
    user_id: uuid.UUID, me: User = Depends(audited_admin), platform: PlatformService = Depends(get_platform_service)
) -> None:
    await platform.remove_admin(me, user_id)
