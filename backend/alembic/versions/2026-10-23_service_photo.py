"""Service photo: each of an artist's services (packages) can have its own photo for the storefront.

Revision ID: 6c1e9b4d2a73
Revises: 8f3a6d2b9e14
Create Date: 2026-10-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "6c1e9b4d2a73"
down_revision: str | Sequence[str] | None = "8f3a6d2b9e14"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("artist_service_item", sa.Column("photo_key", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("artist_service_item", "photo_key")
