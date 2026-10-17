from fastapi import APIRouter, Depends, Query

from app.chat.dependencies import artist_participant, get_chat_service, limit_messages, valid_artist_conversation
from app.chat.models import Conversation
from app.chat.schemas import ConversationOut, ConversationPage, MessageIn, MessageOut, MessagePage, OpenFromBookingIn
from app.chat.service import ChatService, Participant
from app.shared.responses import errors

# An approved artist's chats with customers. Draft, pending or rejected profiles get 409.
router = APIRouter(
    prefix="/artists/me/conversations", tags=["artist chat"], responses=errors(401, 403, 404, 409, 422, 429)
)


@router.post(
    "", response_model=ConversationOut, status_code=200, summary="Open (or reopen) a chat with a booking's customer"
)
async def open_conversation(
    body: OpenFromBookingIn,
    participant: Participant = Depends(artist_participant),
    chats: ChatService = Depends(get_chat_service),
) -> dict:
    return await chats.open_from_booking(participant, body.booking_id)


@router.get("", response_model=ConversationPage, status_code=200, summary="My client chats, latest message first")
async def list_conversations(
    q: str | None = Query(None, max_length=100, description="Client name contains"),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    participant: Participant = Depends(artist_participant),
    chats: ChatService = Depends(get_chat_service),
) -> dict:
    items, next_cursor = await chats.inbox(participant, q, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get(
    "/{conversation_id}/messages", response_model=MessagePage, status_code=200, summary="Messages, newest first"
)
async def list_messages(
    limit: int = Query(30, ge=1, le=100),
    cursor: str | None = None,
    conversation: Conversation = Depends(valid_artist_conversation),
    chats: ChatService = Depends(get_chat_service),
) -> dict:
    items, next_cursor = await chats.messages(conversation, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=201,
    summary="Send a message",
    dependencies=[Depends(limit_messages)],
)
async def send_message(
    body: MessageIn,
    conversation: Conversation = Depends(valid_artist_conversation),
    participant: Participant = Depends(artist_participant),
    chats: ChatService = Depends(get_chat_service),
) -> dict:
    return await chats.send(participant, conversation, body.text)


@router.post("/{conversation_id}/read", response_model=ConversationOut, status_code=200, summary="Mark as read")
async def mark_read(
    conversation: Conversation = Depends(valid_artist_conversation),
    participant: Participant = Depends(artist_participant),
    chats: ChatService = Depends(get_chat_service),
) -> dict:
    return await chats.mark_read(participant, conversation)
