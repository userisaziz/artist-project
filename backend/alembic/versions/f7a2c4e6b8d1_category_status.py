"""categories.status (draft / inactive / active) replaces is_active (migration #7)

Revision ID: f7a2c4e6b8d1
Revises: e5f1b3c7a9d2
Create Date: 2026-10-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'f7a2c4e6b8d1'
down_revision: Union[str, Sequence[str], None] = 'e5f1b3c7a9d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE category_status AS ENUM ('draft', 'inactive', 'active')")
    op.add_column('categories', sa.Column(
        'status', postgresql.ENUM(name='category_status', create_type=False),
        server_default=sa.text("'draft'"), nullable=False,
    ))
    op.execute("UPDATE categories SET status = CASE WHEN is_active THEN 'active'::category_status ELSE 'inactive'::category_status END")
    op.drop_column('categories', 'is_active')


def downgrade() -> None:
    op.add_column('categories', sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False))
    op.execute("UPDATE categories SET is_active = (status = 'active')")
    op.drop_column('categories', 'status')
    op.execute("DROP TYPE category_status")
