from app.models.user.user import User
from app.schemas.user.user import AccountDetails, RoleChoice, UserOut
from app.services.user.user import UserService


def get_me(user: User) -> UserOut:
    return UserOut.model_validate(user)


async def update_me(body: AccountDetails, user: User, service: UserService) -> UserOut:
    return UserOut.model_validate(await service.update_details(user, body))


async def choose_role(body: RoleChoice, user: User, service: UserService) -> UserOut:
    return UserOut.model_validate(await service.choose_role(user, body))
