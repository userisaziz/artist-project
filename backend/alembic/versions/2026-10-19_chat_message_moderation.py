"""Chat: messages the contact filter catches are held for an admin instead of refused.

Revision ID: 4c8e2a6f1b37
Revises: 7a3f5c1e8b92
Create Date: 2026-10-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "4c8e2a6f1b37"
down_revision: str | Sequence[str] | None = "7a3f5c1e8b92"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

moderation = postgresql.ENUM("held", "allowed", "hidden", name="chat_message_moderation", create_type=False)


def upgrade() -> None:
    moderation.create(op.get_bind(), checkfirst=False)
    op.add_column("chat_message", sa.Column("moderation", moderation, nullable=True))
    op.add_column("chat_message", sa.Column("flag", sa.String(length=20), nullable=True))
    op.add_column("chat_message", sa.Column("moderated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("chat_message", sa.Column("moderated_by_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_chat_message_moderated_by_id_user_account",
        "chat_message",
        "user_account",
        ["moderated_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_chat_message_moderation_created",
        "chat_message",
        ["moderation", "created_at", "id"],
        postgresql_where=sa.text("moderation IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_chat_message_moderation_created", table_name="chat_message")
    op.drop_constraint("fk_chat_message_moderated_by_id_user_account", "chat_message", type_="foreignkey")
    op.drop_column("chat_message", "moderated_by_id")
    op.drop_column("chat_message", "moderated_at")
    op.drop_column("chat_message", "flag")
    op.drop_column("chat_message", "moderation")
    moderation.drop(op.get_bind(), checkfirst=False)
