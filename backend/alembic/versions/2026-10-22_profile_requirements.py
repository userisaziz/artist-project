"""Profile requirements: admin settings per requirement (mandatory, grace period) and the notices sent for them.
Seeds the location requirement as optional.

Revision ID: 4d7b1e9a2c60
Revises: 3a6c8e1f5d27
Create Date: 2026-10-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "4d7b1e9a2c60"
down_revision: str | Sequence[str] | None = "3a6c8e1f5d27"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "requirement_setting",
        sa.Column("key", sa.String(length=40), nullable=False),
        sa.Column("mandatory", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("grace_days", sa.SmallInteger(), server_default=sa.text("7"), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("grace_days BETWEEN 0 AND 90", name="ck_requirement_setting_grace_days_range"),
        sa.PrimaryKeyConstraint("key", name="pk_requirement_setting"),
    )
    op.create_table(
        "requirement_notice",
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("key", sa.String(length=40), nullable=False),
        sa.Column("stage", sa.String(length=30), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["artist_id"],
            ["artist_profile.id"],
            name="fk_requirement_notice_artist_id_artist_profile",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("artist_id", "key", "stage", name="pk_requirement_notice"),
    )
    op.execute("INSERT INTO requirement_setting (key, mandatory, grace_days) VALUES ('location', false, 7)")


def downgrade() -> None:
    op.drop_table("requirement_notice")
    op.drop_table("requirement_setting")
