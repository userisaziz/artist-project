import uuid

from fastapi import APIRouter, Depends, Response

from app.core.auth import audited_admin
from app.requirement.dependencies import get_requirement_service
from app.requirement.schemas import MyRequirements, RequirementSettingIn, RequirementSettingOut
from app.requirement.service import RequirementService
from app.shared.responses import errors

router = APIRouter(
    prefix="/admin", tags=["admin"], dependencies=[Depends(audited_admin)], responses=errors(401, 403, 404, 409, 422)
)


@router.get(
    "/settings/requirements",
    response_model=list[RequirementSettingOut],
    status_code=200,
    summary="Profile requirements and whether each is mandatory",
)
async def list_requirements(requirements: RequirementService = Depends(get_requirement_service)) -> list[dict]:
    return await requirements.settings()


@router.put(
    "/settings/requirements/{key}",
    response_model=RequirementSettingOut,
    status_code=200,
    summary="Make a requirement mandatory (or not) and set its grace period",
    description="Switching it on starts the grace period now; approved artists still missing it afterwards are "
    "hidden and take no new bookings until they complete it.",
)
async def update_requirement(
    key: str, body: RequirementSettingIn, requirements: RequirementService = Depends(get_requirement_service)
) -> dict:
    return await requirements.update(key, body)


@router.get(
    "/requirements/{artist_id}",
    response_model=MyRequirements,
    status_code=200,
    summary="What an artist still has to add to their profile",
)
async def artist_requirements(
    artist_id: uuid.UUID, requirements: RequirementService = Depends(get_requirement_service)
) -> dict:
    return await requirements.for_artist(artist_id)


@router.post(
    "/requirements/{artist_id}/remind",
    status_code=204,
    response_class=Response,
    summary="Remind an artist to complete their profile",
)
async def remind_artist(
    artist_id: uuid.UUID, requirements: RequirementService = Depends(get_requirement_service)
) -> Response:
    await requirements.remind(artist_id)
    return Response(status_code=204)
