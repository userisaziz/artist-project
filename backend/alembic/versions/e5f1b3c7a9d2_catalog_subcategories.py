"""subcategories, service_templates, artist_services template/status (migration #6: catalog)

Revision ID: e5f1b3c7a9d2
Revises: d8e2a6b4c1f9
Create Date: 2026-10-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "e5f1b3c7a9d2"
down_revision: Union[str, Sequence[str], None] = "d8e2a6b4c1f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("categories", sa.Column("parent_id", sa.Integer(), sa.ForeignKey("categories.id"), nullable=True))
    op.create_index("ix_categories_parent_id", "categories", ["parent_id"])

    op.create_table(
        "service_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("subcategory_id", sa.Integer(), sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.create_index("ix_service_templates_subcategory_id", "service_templates", ["subcategory_id"])
    op.create_index(
        "uq_service_templates_subcategory_name",
        "service_templates",
        ["subcategory_id", sa.text("lower(name)")],
        unique=True,
    )

    op.execute("CREATE TYPE artist_service_status AS ENUM ('approved', 'pending', 'rejected')")
    op.add_column(
        "artist_services",
        sa.Column(
            "status",
            postgresql.ENUM(name="artist_service_status", create_type=False),
            server_default=sa.text("'approved'"),
            nullable=False,
        ),
    )
    op.add_column(
        "artist_services", sa.Column("template_id", sa.Integer(), sa.ForeignKey("service_templates.id"), nullable=True)
    )
    op.create_index("ix_artist_services_template_id", "artist_services", ["template_id"])
    op.add_column("artist_services", sa.Column("rejection_reason", sa.String(500), nullable=True))
    op.alter_column("artist_services", "name", existing_type=sa.String(120), nullable=True)
    op.create_check_constraint(
        "ck_artist_services_name_or_template", "artist_services", "template_id IS NOT NULL OR name IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_constraint("ck_artist_services_name_or_template", "artist_services", type_="check")
    # Fails (and rolls back) while template rows exist: their names live in service_templates.
    op.alter_column("artist_services", "name", existing_type=sa.String(120), nullable=False)
    op.drop_column("artist_services", "rejection_reason")
    op.drop_index("ix_artist_services_template_id", table_name="artist_services")
    op.drop_column("artist_services", "template_id")
    op.drop_column("artist_services", "status")
    op.execute("DROP TYPE artist_service_status")
    op.drop_table("service_templates")
    op.drop_index("ix_categories_parent_id", table_name="categories")
    op.drop_column("categories", "parent_id")
