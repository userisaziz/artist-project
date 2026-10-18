import uuid

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.booking.service import approved_artist_id
from app.chat import constants
from app.chat.constants import ChatSide
from app.chat.models import Conversation
from app.chat.service import ChatService, Participant
from app.core.auth import current_artist, current_customer
from app.core.database import get_db
from app.core.rate_limit import Limit, limit_by_user
from app.shared.clock import Clock, get_clock
from app.upload.service import ImageStorage, get_storage
from app.user.models import User


def get_chat_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    storage: ImageStorage = Depends(get_storage),
    clock: Clock = Depends(get_clock),
) -> ChatService:
    return ChatService(session, storage, clock)


async def customer_participant(user: User = Depends(current_customer)) -> Participant:
    return Participant(ChatSide.customer, user.id)


async def artist_participant(
    user: User = Depends(current_artist), session: AsyncSession = Depends(get_db, scope="function")
) -> Participant:
    """Chat opens with bookings: only once the artist's profile is approved (409 before)."""
    return Participant(ChatSide.artist, await approved_artist_id(session, user))


async def valid_customer_conversation(
    conversation_id: uuid.UUID,
    participant: Participant = Depends(customer_participant),
    chats: ChatService = Depends(get_chat_service),
) -> Conversation:
    return await chats.conversation(participant, conversation_id)


async def valid_artist_conversation(
    conversation_id: uuid.UUID,
    participant: Participant = Depends(artist_participant),
    chats: ChatService = Depends(get_chat_service),
) -> Conversation:
    return await chats.conversation(participant, conversation_id)


def messages_per_user() -> Limit:
    return constants.MESSAGES_PER_USER


def message_burst_per_user() -> Limit:
    return constants.MESSAGE_BURST_PER_USER


def opens_per_user() -> Limit:
    return constants.OPENS_PER_USER


limit_hourly_messages = limit_by_user("chat_message", messages_per_user)
limit_message_burst = limit_by_user("chat_message_burst", message_burst_per_user)
limit_opens = limit_by_user("chat_open", opens_per_user)


async def limit_messages(
    _hourly: None = Depends(limit_hourly_messages), _burst: None = Depends(limit_message_burst)
) -> None:
    """Sends: at most 20 a minute and 300 an hour per user."""
