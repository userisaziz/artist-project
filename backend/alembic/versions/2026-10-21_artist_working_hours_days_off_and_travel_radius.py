"""Artist schedule: weekly working hours, days off, and a display-only travel radius on the profile.

No backfill: an artist without working-hour rows uses the default hours (every day 08:00-20:00 IST).

Revision ID: 13b3c7fe1c40
Revises: 3b8d5f1a7c64
Create Date: 2026-10-21
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "13b3c7fe1c40"
down_revision: str | Sequence[str] | None = "3b8d5f1a7c64"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("artist_profile", sa.Column("travel_radius_km", sa.SmallInteger(), nullable=True))
    op.create_check_constraint(
        "ck_artist_profile_travel_radius_km_range", "artist_profile", "travel_radius_km BETWEEN 1 AND 100"
    )
    op.create_table(
        "artist_working_hour",
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("weekday", sa.SmallInteger(), nullable=False),
        sa.Column("is_open", sa.Boolean(), nullable=False),
        sa.Column("open_hour", sa.SmallInteger(), nullable=False),
        sa.Column("close_hour", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_artist_working_hour_weekday_range"),
        sa.CheckConstraint(
            "0 <= open_hour AND open_hour < close_hour AND close_hour <= 24", name="ck_artist_working_hour_hours_range"
        ),
        sa.ForeignKeyConstraint(
            ["artist_id"],
            ["artist_profile.id"],
            name="fk_artist_working_hour_artist_id_artist_profile",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("artist_id", "weekday", name="pk_artist_working_hour"),
    )
    op.create_table(
        "artist_day_off",
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("day_date", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(
            ["artist_id"],
            ["artist_profile.id"],
            name="fk_artist_day_off_artist_id_artist_profile",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("artist_id", "day_date", name="pk_artist_day_off"),
    )


def downgrade() -> None:
    op.drop_table("artist_day_off")
    op.drop_table("artist_working_hour")
    op.drop_constraint("ck_artist_profile_travel_radius_km_range", "artist_profile", type_="check")
    op.drop_column("artist_profile", "travel_radius_km")
