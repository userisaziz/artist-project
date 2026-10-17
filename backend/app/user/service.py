"""Account rules for the signed-in user: sign-up details, then picking (or switching) the app role."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.shared.enums import UserRole
from app.user.models import User
from app.user.repository import UserRepository
from app.user.schemas import AccountDetails, RoleChoice


class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.users = UserRepository(session)

    async def update_details(self, user: User, details: AccountDetails) -> User:
        if details.email and details.email != user.email:
            taken = await self.users.id_by_email(details.email)
            if taken:
                raise ConflictError("Email already in use")
        user.first_name = details.first_name
        user.last_name = details.last_name
        user.email = details.email
        user.whatsapp_booking_updates = details.whatsapp_booking_updates
        try:
            await self.session.flush()
        except IntegrityError as exc:  # someone took the email between the check and the write
            raise ConflictError("Email already in use") from exc
        return user

    async def choose_role(self, user: User, choice: RoleChoice) -> User:
        """Choose role and later "Switch to artist/customer": grant the role if new, then show that side."""
        role = UserRole(choice.role)
        user.grant(role)
        user.active_role = role
        await self.session.flush()
        return user
