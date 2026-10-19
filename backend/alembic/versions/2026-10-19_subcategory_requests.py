"""Subcategory requests: artists suggest a subcategory while adding a custom service; admins approve or reject it.

Revision ID: 9d1f3b5a7c24
Revises: 5e2b8d4f9a61
Create Date: 2026-10-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "9d1f3b5a7c24"
down_revision: str | Sequence[str] | None = "5e2b8d4f9a61"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

status = postgresql.ENUM("pending", "approved", "rejected", name="subcategory_request_status", create_type=False)
NOW = sa.text("now()")


def upgrade() -> None:
    status.create(op.get_bind(), checkfirst=False)
    op.create_table(
        "subcategory_request",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=300), nullable=True),
        sa.Column("status", status, server_default=sa.text("'pending'"), nullable=False),
        sa.Column("rejection_reason", sa.String(length=500), nullable=True),
        sa.Column("subcategory_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(
            ["artist_id"],
            ["artist_profile.id"],
            name="fk_subcategory_request_artist_id_artist_profile",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["catalog_category.id"], name="fk_subcategory_request_parent_id_catalog_category"
        ),
        sa.ForeignKeyConstraint(
            ["subcategory_id"],
            ["catalog_category.id"],
            name="fk_subcategory_request_subcategory_id_catalog_category",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_id"],
            ["user_account.id"],
            name="fk_subcategory_request_reviewed_by_id_user_account",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_subcategory_request"),
    )
    op.create_index("ix_subcategory_request_artist_id", "subcategory_request", ["artist_id"])
    op.create_index("ix_subcategory_request_status_created", "subcategory_request", ["status", "created_at", "id"])
    op.add_column("artist_service_item", sa.Column("suggestion_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_artist_service_item_suggestion_id_subcategory_request",
        "artist_service_item",
        "subcategory_request",
        ["suggestion_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_artist_service_item_suggestion_id", "artist_service_item", ["suggestion_id"])


def downgrade() -> None:
    op.drop_index("ix_artist_service_item_suggestion_id", table_name="artist_service_item")
    op.drop_constraint(
        "fk_artist_service_item_suggestion_id_subcategory_request", "artist_service_item", type_="foreignkey"
    )
    op.drop_column("artist_service_item", "suggestion_id")
    op.drop_index("ix_subcategory_request_status_created", table_name="subcategory_request")
    op.drop_index("ix_subcategory_request_artist_id", table_name="subcategory_request")
    op.drop_table("subcategory_request")
    status.drop(op.get_bind(), checkfirst=False)
