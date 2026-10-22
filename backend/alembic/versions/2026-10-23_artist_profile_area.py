"""Artist profile area: the catalog area picked in the Location step. Existing free-text areas that match an area
of the artist's city by name are linked; the rest stay unlinked, and the location requirement asks those artists
to pick one.

Revision ID: 8f3a6d2b9e14
Revises: 4d7b1e9a2c60
Create Date: 2026-10-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "8f3a6d2b9e14"
down_revision: str | Sequence[str] | None = "4d7b1e9a2c60"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("artist_profile", sa.Column("area_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_artist_profile_area_id_catalog_area",
        "artist_profile",
        "catalog_area",
        ["area_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_artist_profile_area_id", "artist_profile", ["area_id"])
    op.execute(
        "UPDATE artist_profile AS p SET area_id = a.id, locality = a.name FROM catalog_area AS a "
        "WHERE a.city = p.city AND lower(a.name) = lower(trim(p.locality))"
    )


def downgrade() -> None:
    op.drop_index("ix_artist_profile_area_id", table_name="artist_profile")
    op.drop_constraint("fk_artist_profile_area_id_catalog_area", "artist_profile", type_="foreignkey")
    op.drop_column("artist_profile", "area_id")
