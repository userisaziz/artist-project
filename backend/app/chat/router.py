from fastapi import APIRouter, Depends, Query

from app.chat.dependencies import customer_participant, get_chat_service, limit_messages, valid_customer_conversation
from app.chat.models import Conversation
from app.chat.schemas import ConversationOut, ConversationPage, MessageIn, MessageOut, MessagePage, OpenWithArtistIn
from app.chat.service import ChatService, Participant
from app.shared.responses import errors

# A customer's chats with artists. Someone else's conversation reads as 404, never 403.
router = APIRouter(prefix="/conversations", tags=["chat"], responses=errors(401, 403, 404, 409, 422, 429))


@router.post("", response_model=ConversationOut, status_code=200, summary="Open (or reopen) a chat with an artist")
async def open_conversation(
    body: OpenWithArtistIn,
    participant: Participant = Depends(customer_participant),
    chats: ChatService = Depends(get_chat_service),
) -> dict:
    return await chats.open_with_artist(participant, body.artist_id)


@router.get("", response_model=ConversationPage, status_code=200, summary="My chats, latest message first")
async def list_conversations(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    participant: Participant = Depends(customer_participant),
    chats: ChatService = Depends(get_chat_service),
) -> dict:
    items, next_cursor = await chats.inbox(participant, None, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/{conversation_id}", response_model=ConversationOut, status_code=200, summary="One conversation")
async def get_conversation(
    conversation: Conversation = Depends(valid_customer_conversation),
    participant: Participant = Depends(customer_participant),
    chats: ChatService = Depends(get_chat_service),
) -> dict:
    return await chats.get(participant, conversation)


@router.get(
    "/{conversation_id}/messages", response_model=MessagePage, status_code=200, summary="Messages, newest first"
)
async def list_messages(
    limit: int = Query(30, ge=1, le=100),
    cursor: str | None = None,
    conversation: Conversation = Depends(valid_customer_conversation),
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
    conversation: Conversation = Depends(valid_customer_conversation),
    participant: Participant = Depends(customer_participant),
    chats: ChatService = Depends(get_chat_service),
) -> dict:
    return await chats.send(participant, conversation, body.text)


@router.post("/{conversation_id}/read", response_model=ConversationOut, status_code=200, summary="Mark as read")
async def mark_read(
    conversation: Conversation = Depends(valid_customer_conversation),
    participant: Participant = Depends(customer_participant),
    chats: ChatService = Depends(get_chat_service),
) -> dict:
    return await chats.mark_read(participant, conversation)
