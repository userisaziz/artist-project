"""Chat indexes in keyset order: each side's inbox (partial, conversations with a message) and the thread.
Drops the customer_id index the unique (customer_id, artist_id) pair already covers.

Revision ID: 8a4c6e2f9b17
Revises: 5d2f8b1c7e40
Create Date: 2026-10-18
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "8a4c6e2f9b17"
down_revision: str | Sequence[str] | None = "5d2f8b1c7e40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

HAS_MESSAGE = sa.text("last_message_at IS NOT NULL")


def upgrade() -> None:
    op.drop_index("ix_chat_conversation_customer_id", table_name="chat_conversation")
    op.create_index(
        "ix_chat_conversation_customer_inbox",
        "chat_conversation",
        ["customer_id", "last_message_at", "id"],
        postgresql_where=HAS_MESSAGE,
    )
    op.create_index(
        "ix_chat_conversation_artist_inbox",
        "chat_conversation",
        ["artist_id", "last_message_at", "id"],
        postgresql_where=HAS_MESSAGE,
    )
    op.drop_index("ix_chat_message_conversation_created", table_name="chat_message")
    op.create_index("ix_chat_message_conversation_created", "chat_message", ["conversation_id", "created_at", "id"])


def downgrade() -> None:
    op.drop_index("ix_chat_message_conversation_created", table_name="chat_message")
    op.create_index("ix_chat_message_conversation_created", "chat_message", ["conversation_id", "created_at"])
    op.drop_index("ix_chat_conversation_artist_inbox", table_name="chat_conversation")
    op.drop_index("ix_chat_conversation_customer_inbox", table_name="chat_conversation")
    op.create_index("ix_chat_conversation_customer_id", "chat_conversation", ["customer_id"])
