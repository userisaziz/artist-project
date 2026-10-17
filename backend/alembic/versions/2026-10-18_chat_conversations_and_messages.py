"""Chat: one conversation per customer–artist pair, and its messages.

Revision ID: 5d2f8b1c7e40
Revises: 7e3a9c5d2b14
Create Date: 2026-10-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "5d2f8b1c7e40"
down_revision: str | Sequence[str] | None = "7e3a9c5d2b14"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

chat_side = postgresql.ENUM("customer", "artist", name="chat_side", create_type=False)


def upgrade() -> None:
    chat_side.create(op.get_bind(), checkfirst=False)
    op.create_table(
        "chat_conversation",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("customer_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("artist_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["artist_id"], ["artist_profile.id"], name="fk_chat_conversation_artist_id_artist_profile"
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"], ["user_account.id"], name="fk_chat_conversation_customer_id_user_account"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_chat_conversation"),
        sa.UniqueConstraint("customer_id", "artist_id", name="uq_chat_conversation_pair"),
    )
    op.create_index("ix_chat_conversation_artist_id", "chat_conversation", ["artist_id"])
    op.create_index("ix_chat_conversation_customer_id", "chat_conversation", ["customer_id"])
    op.create_table(
        "chat_message",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("conversation_id", sa.UUID(), nullable=False),
        sa.Column("sender", chat_side, nullable=False),
        sa.Column("text", sa.String(length=2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["chat_conversation.id"],
            name="fk_chat_message_conversation_id_chat_conversation",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_chat_message"),
    )
    op.create_index("ix_chat_message_conversation_created", "chat_message", ["conversation_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_chat_message_conversation_created", table_name="chat_message")
    op.drop_table("chat_message")
    op.drop_index("ix_chat_conversation_customer_id", table_name="chat_conversation")
    op.drop_index("ix_chat_conversation_artist_id", table_name="chat_conversation")
    op.drop_table("chat_conversation")
    chat_side.drop(op.get_bind(), checkfirst=False)
