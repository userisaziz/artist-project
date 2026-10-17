from fastapi import APIRouter, Depends

from app.controllers.user import user as controller
from app.controllers.user.dependencies import get_user_service
from app.core.auth import get_current_user
from app.models.user.user import User
from app.schemas.user.user import AccountDetails, RoleChoice, UserOut
from app.services.user.user import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)) -> UserOut:
    return controller.get_me(user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: AccountDetails,
    user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
) -> UserOut:
    return await controller.update_me(body, user, service)


@router.put("/me/role", response_model=UserOut)
async def choose_role(
    body: RoleChoice,
    user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
) -> UserOut:
    return await controller.choose_role(body, user, service)
