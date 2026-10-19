"""Artists can be suspended: a new artist_status value and the artist_suspension record (reason, when, who).

Revision ID: 2b7c9e4a6d13
Revises: 9d4e2b6f1a38
Create Date: 2026-10-19
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "2b7c9e4a6d13"
down_revision: str | Sequence[str] | None = "9d4e2b6f1a38"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUSES = ("draft", "pending", "approved", "rejected")


def upgrade() -> None:
    with op.get_context().autocommit_block():  # a new enum value must be committed before it can be used
        op.execute("ALTER TYPE artist_status ADD VALUE IF NOT EXISTS 'suspended'")
    op.create_table(
        "artist_suspension",
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=False),
        sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("suspended_by", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(
            ["artist_id"],
            ["artist_profile.id"],
            name="fk_artist_suspension_artist_id_artist_profile",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["suspended_by"],
            ["user_account.id"],
            name="fk_artist_suspension_suspended_by_user_account",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("artist_id", name="pk_artist_suspension"),
    )


def downgrade() -> None:
    op.drop_table("artist_suspension")
    # Postgres can't drop an enum value: reinstate everyone, then rebuild the type without it.
    op.execute("UPDATE artist_profile SET status = 'approved' WHERE status = 'suspended'")
    op.execute("ALTER TABLE artist_profile ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TYPE artist_status RENAME TO artist_status_old")
    op.execute(f"CREATE TYPE artist_status AS ENUM ({', '.join(repr(s) for s in STATUSES)})")
    op.execute("ALTER TABLE artist_profile ALTER COLUMN status TYPE artist_status USING status::text::artist_status")
    op.execute("ALTER TABLE artist_profile ALTER COLUMN status SET DEFAULT 'draft'")
    op.execute("DROP TYPE artist_status_old")
