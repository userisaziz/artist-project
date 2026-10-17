"""artist_kyc and aadhaar_reveals (migration #5: Aadhaar verification)

Revision ID: d8e2a6b4c1f9
Revises: c4d1f7a9b2e3
Create Date: 2026-10-12
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "d8e2a6b4c1f9"
down_revision: Union[str, Sequence[str], None] = "c4d1f7a9b2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "artist_kyc",
        sa.Column("artist_id", sa.UUID(), sa.ForeignKey("artist_profiles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("aadhaar_encrypted", sa.Text(), nullable=False),
        sa.Column("aadhaar_last4", sa.String(4), nullable=False),
        sa.Column("front_key", sa.String(255), nullable=False),
        sa.Column("back_key", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "aadhaar_reveals",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "artist_id", sa.UUID(), sa.ForeignKey("artist_profiles.id", ondelete="CASCADE"), nullable=False, index=True
        ),
        sa.Column("admin_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("revealed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("aadhaar_reveals")
    op.drop_table("artist_kyc")
