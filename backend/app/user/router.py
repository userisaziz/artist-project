from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.shared.responses import errors
from app.user.dependencies import get_user_service
from app.user.models import User
from app.user.schemas import AccountDetails, RoleChoice, UserOut
from app.user.service import UserService

router = APIRouter(prefix="/users", tags=["users"], responses=errors(401, 422))


@router.get("/me", response_model=UserOut, status_code=200, summary="Current user")
async def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut, summary="Save sign-up details", status_code=200)
async def update_me(
    body: AccountDetails,
    user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
) -> User:
    return await service.update_details(user, body)


@router.put(
    "/me/role", response_model=UserOut, summary="Pick or switch the app side (customer or artist)", status_code=200
)
async def choose_role(
    body: RoleChoice,
    user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
) -> User:
    return await service.choose_role(user, body)
