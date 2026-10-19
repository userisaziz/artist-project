"""Support: tickets (reported in the app or logged for a phone request) and their message thread.

Revision ID: 7a3f5c1e8b92
Revises: 2b7c9e4a6d13
Create Date: 2026-10-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "7a3f5c1e8b92"
down_revision: str | Sequence[str] | None = "2b7c9e4a6d13"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

status = postgresql.ENUM("new", "open", "waiting_on_user", "resolved", name="support_ticket_status", create_type=False)
priority = postgresql.ENUM("low", "normal", "urgent", name="support_ticket_priority", create_type=False)
NOW = sa.text("now()")


def upgrade() -> None:
    status.create(op.get_bind(), checkfirst=False)
    priority.create(op.get_bind(), checkfirst=False)
    op.create_table(
        "support_ticket",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("code", sa.String(length=12), nullable=False),
        sa.Column("requester_id", sa.UUID(), nullable=False),
        sa.Column("requester_side", sa.String(length=10), nullable=False),
        sa.Column("topic", sa.String(length=10), nullable=False),
        sa.Column("issue", sa.String(length=30), nullable=False),
        sa.Column("booking_id", sa.UUID(), nullable=True),
        sa.Column("channel", sa.String(length=10), nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column("priority", priority, nullable=False),
        sa.Column("assignee_id", sa.UUID(), nullable=True),
        sa.Column("last_requester_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("first_response_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(
            ["assignee_id"], ["user_account.id"], name="fk_support_ticket_assignee_id_user_account", ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["booking_id"], ["booking.id"], name="fk_support_ticket_booking_id_booking", ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["requester_id"],
            ["user_account.id"],
            name="fk_support_ticket_requester_id_user_account",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_support_ticket"),
        sa.UniqueConstraint("code", name="uq_support_ticket_code"),
    )
    op.create_index("ix_support_ticket_requester_id", "support_ticket", ["requester_id"])
    op.create_index("ix_support_ticket_assignee_id", "support_ticket", ["assignee_id"])
    op.create_index("ix_support_ticket_status", "support_ticket", ["status"])
    op.create_index("ix_support_ticket_last_requester", "support_ticket", ["last_requester_at", "id"])
    op.create_table(
        "support_message",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("ticket_id", sa.UUID(), nullable=False),
        sa.Column("author", sa.String(length=10), nullable=False),
        sa.Column("author_id", sa.UUID(), nullable=True),
        sa.Column("text", sa.String(length=2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["author_id"], ["user_account.id"], name="fk_support_message_author_id_user_account", ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["ticket_id"], ["support_ticket.id"], name="fk_support_message_ticket_id_support_ticket", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_support_message"),
    )
    op.create_index("ix_support_message_ticket_created", "support_message", ["ticket_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_support_message_ticket_created", table_name="support_message")
    op.drop_table("support_message")
    for name in (
        "ix_support_ticket_last_requester",
        "ix_support_ticket_status",
        "ix_support_ticket_assignee_id",
        "ix_support_ticket_requester_id",
    ):
        op.drop_index(name, table_name="support_ticket")
    op.drop_table("support_ticket")
    priority.drop(op.get_bind(), checkfirst=False)
    status.drop(op.get_bind(), checkfirst=False)
