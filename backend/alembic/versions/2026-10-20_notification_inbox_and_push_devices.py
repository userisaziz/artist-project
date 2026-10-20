"""Notifications: a person's inbox, and the Expo push tokens of their devices.

Revision ID: 3b8d5f1a7c64
Revises: 1f6a3c9e2d58
Create Date: 2026-10-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "3b8d5f1a7c64"
down_revision: str | Sequence[str] | None = "1f6a3c9e2d58"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOW = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "notification",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("body", sa.String(300), nullable=False),
        sa.Column("link", sa.String(200), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user_account.id"], name=op.f("fk_notification_user_id_user_account"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notification")),
    )
    op.create_index("ix_notification_user_created", "notification", ["user_id", "created_at", "id"])
    op.create_table(
        "notification_push_device",
        sa.Column("token", sa.String(200), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_account.id"],
            name=op.f("fk_notification_push_device_user_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("token", name=op.f("pk_notification_push_device")),
    )
    op.create_index(op.f("ix_notification_push_device_user_id"), "notification_push_device", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_notification_push_device_user_id"), table_name="notification_push_device")
    op.drop_table("notification_push_device")
    op.drop_index("ix_notification_user_created", table_name="notification")
    op.drop_table("notification")
