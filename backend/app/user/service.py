"""Account rules for the signed-in user: sign-up details, picking (or switching) the app role, and deleting
the account."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist import service as artist_service
from app.auth import repository as auth_repository
from app.booking import service as booking_service
from app.core.audit import audit
from app.core.exceptions import ConflictError
from app.feed import service as feed_service
from app.notification import service as notification_service
from app.saved import service as saved_service
from app.shared.clock import Clock
from app.shared.enums import UserRole
from app.shop import order_service, product_service
from app.upload.service import ImageStorage
from app.user.models import User
from app.user.repository import UserRepository
from app.user.schemas import AccountDetails, RoleChoice

# Fits user_account.phone (String(20)) and can never be a real E.164 number, so the phone is free to sign up again.
DELETED_PHONE_PREFIX = "del-"
DELETED_PHONE_ID_CHARS = 16


def deleted_phone(user: User) -> str:
    return DELETED_PHONE_PREFIX + user.id.hex[:DELETED_PHONE_ID_CHARS]


class UserService:
    def __init__(self, session: AsyncSession, storage: ImageStorage, clock: Clock):
        self.session = session
        self.users = UserRepository(session)
        self.storage = storage
        self.clock = clock

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

    async def delete_account(self, user: User) -> None:
        """Anonymise now, in one transaction: cancel what is still ahead (telling the other side), take the
        artist profile out of sight with its photos, KYC and posts, end every session, and blank the account in
        place so past bookings, orders, reviews and chats keep their references. Images are removed from
        storage only after the commit, so a failed deletion never leaves rows pointing at deleted files."""
        erased = await artist_service.ArtistService(self.session, self.storage, self.clock).erase(user)
        artist_id = erased.artist_id if erased else None
        await booking_service.cancel_upcoming_for_deleted_account(self.session, self.clock.now(), user.id, artist_id)
        await order_service.OrderService(self.session, self.storage, self.clock).cancel_open_for_deleted_account(
            user.id, artist_id
        )
        post_keys: list[str] = []
        if artist_id is not None:
            await product_service.ProductService(self.session, self.storage).deactivate_all(artist_id)
            post_keys = await feed_service.FeedService(self.session, self.storage, self.clock).delete_all_for_artist(
                artist_id
            )
        await auth_repository.AuthRepository(self.session).delete_refresh_tokens(user.id)
        await notification_service.NotificationService(self.session).forget(user.id)
        await saved_service.forget(self.session, user.id)
        self._anonymise(user)
        await self.session.commit()
        audit("user.account_deleted", user_id=str(user.id), artist_id=str(artist_id) if artist_id else None)

        public = post_keys + (erased.public_keys if erased else [])
        for key in public:
            await self.storage.delete(key)
        for key in erased.private_keys if erased else []:
            await self.storage.delete(key, private=True)

    def _anonymise(self, user: User) -> None:
        user.phone = deleted_phone(user)
        user.email = None
        user.first_name = None
        user.last_name = None
        user.avatar_url = None
        user.password_hash = None
        user.is_active = False
        user.is_phone_verified = False
        user.is_email_verified = False
        user.whatsapp_booking_updates = False
        user.active_role = None
        user.role_grants.clear()
