"""Account rules for the signed-in user: sign-up details, then picking (or switching) the app role."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.models.user import User
from app.schemas.user import AccountDetails, RoleChoice
from app.utils.enums import UserRole


class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def update_details(self, user: User, details: AccountDetails) -> User:
        if details.email and details.email != user.email:
            taken = await self.session.scalar(select(User.id).where(User.email == details.email))
            if taken:
                raise ConflictError("Email already in use")
        user.first_name = details.first_name
        user.last_name = details.last_name
        user.email = details.email
        user.whatsapp_booking_updates = details.whatsapp_booking_updates
        await self.session.flush()
        return user

    async def choose_role(self, user: User, choice: RoleChoice) -> User:
        """Choose role and later "Switch to artist/customer": grant the role if new, then show that side."""
        role = UserRole(choice.role)
        user.grant(role)
        user.active_role = role
        await self.session.flush()
        return user
