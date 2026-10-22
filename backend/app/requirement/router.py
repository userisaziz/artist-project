from fastapi import APIRouter, Depends

from app.core.auth import current_artist
from app.requirement.dependencies import get_requirement_service
from app.requirement.schemas import MyRequirements
from app.requirement.service import RequirementService
from app.shared.responses import errors
from app.user.models import User

router = APIRouter(prefix="/artists/me/requirements", tags=["artists"], responses=errors(401, 403, 404))


@router.get(
    "",
    response_model=MyRequirements,
    status_code=200,
    summary="What I still have to add to my profile",
    description="Mandatory requirements I haven't met, with their deadlines; `on_hold` once one is overdue.",
)
async def my_requirements(
    user: User = Depends(current_artist), requirements: RequirementService = Depends(get_requirement_service)
) -> dict:
    return await requirements.mine(user)
