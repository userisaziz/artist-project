from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.modules.users.models import User
from app.modules.users.schemas import AccountDetails, RoleChoice, UserOut
from app.modules.users.service import UserService, get_user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: AccountDetails,
    user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
) -> UserOut:
    return UserOut.model_validate(await service.update_details(user, body))


@router.put("/me/role", response_model=UserOut)
async def choose_role(
    body: RoleChoice,
    user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
) -> UserOut:
    return UserOut.model_validate(await service.choose_role(user, body))
