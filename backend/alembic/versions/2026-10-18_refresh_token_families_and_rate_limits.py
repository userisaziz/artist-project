"""Refresh-token families (reuse detection, logout) and the shared rate-limit counters.

Existing refresh tokens each become their own family.

Revision ID: 4b8d2f6a1c93
Revises: 9c1e5a7b3d20
Create Date: 2026-10-18
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "4b8d2f6a1c93"
down_revision: str | Sequence[str] | None = "9c1e5a7b3d20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "auth_refresh_token",
        sa.Column("family_id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
    )
    op.alter_column("auth_refresh_token", "family_id", server_default=None)
    op.create_index(op.f("ix_auth_refresh_token_family_id"), "auth_refresh_token", ["family_id"])

    op.create_table(
        "core_rate_limit_bucket",
        sa.Column("key", sa.String(length=200), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("hit_count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_core_rate_limit_bucket")),
    )
    op.create_index(
        op.f("ix_core_rate_limit_bucket_window_started_at"), "core_rate_limit_bucket", ["window_started_at"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_core_rate_limit_bucket_window_started_at"), table_name="core_rate_limit_bucket")
    op.drop_table("core_rate_limit_bucket")
    op.drop_index(op.f("ix_auth_refresh_token_family_id"), table_name="auth_refresh_token")
    op.drop_column("auth_refresh_token", "family_id")
