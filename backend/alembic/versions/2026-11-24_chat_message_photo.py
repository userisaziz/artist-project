"""Chat messages can carry a photo (an upload with purpose "chat").

Revision ID: c4a7f0d2e9b1
Revises: a3d9f1c7e5b2
Create Date: 2026-11-24
"""

import sqlalchemy as sa

from alembic import op

revision = "c4a7f0d2e9b1"
down_revision = "a3d9f1c7e5b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chat_message", sa.Column("photo_key", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_message", "photo_key")
