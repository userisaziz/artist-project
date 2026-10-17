"""No overlapping slot-holding bookings per artist (exclusion constraint) and trigram search indexes.

Overdue unanswered requests are expired first, exactly as the API does lazily, so they don't count
as holding a slot. Needs the btree_gist and pg_trgm extensions (both ship with Postgres).

Revision ID: 7e3a9c5d2b14
Revises: 4b8d2f6a1c93
Create Date: 2026-10-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "7e3a9c5d2b14"
down_revision: str | Sequence[str] | None = "4b8d2f6a1c93"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TRIGRAM_INDEXES = [
    ("ix_artist_profile_business_name_trgm", "artist_profile", "business_name"),
    ("ix_artist_service_item_name_trgm", "artist_service_item", "name"),
    ("ix_catalog_service_template_name_trgm", "catalog_service_template", "name"),
]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "UPDATE booking SET status = 'expired', refund_due = true WHERE status = 'requested' AND expires_at <= now()"
    )
    op.execute(
        "ALTER TABLE booking ADD CONSTRAINT ex_booking_no_overlap EXCLUDE USING gist "
        "(artist_id WITH =, tstzrange(start_at, end_at) WITH &&) WHERE (status IN ('requested', 'confirmed'))"
    )
    for name, table, column in TRIGRAM_INDEXES:
        op.create_index(name, table, [column], postgresql_using="gin", postgresql_ops={column: "gin_trgm_ops"})


def downgrade() -> None:
    for name, table, _column in reversed(TRIGRAM_INDEXES):
        op.drop_index(name, table_name=table)
    op.execute("ALTER TABLE booking DROP CONSTRAINT ex_booking_no_overlap")
    # The extensions stay: other objects may use them, and they are harmless.
