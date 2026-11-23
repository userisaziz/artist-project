"""Index completed bookings per artist for the admin directory's per-row figures.

Each admin directory row counts an artist's completed bookings and sums their value over a window.
The only booking index led with (artist_id, start_at), so both subqueries read every booking the
artist ever had and filtered on status. This partial index holds only completed rows, keyed by
artist and completion time, and carries the total so the sum never touches the table.

Revision ID: a3d9f1c7e5b2
Revises: e7b4c1a9d3f6
Create Date: 2026-11-02
"""

from collections.abc import Sequence

from alembic import op

revision: str = "a3d9f1c7e5b2"
down_revision: str | Sequence[str] | None = "e7b4c1a9d3f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX ix_booking_artist_completed ON booking (artist_id, completed_at) "
        "INCLUDE (total_paise) WHERE status = 'completed'"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_booking_artist_completed")
