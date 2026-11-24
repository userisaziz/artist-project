"""Per-category service rules: fulfilment and admin-defined fields; service attributes and per-person pricing;
booking and enquiry answers. Every existing row keeps today's behaviour (appointment, package, no fields).

Revision ID: 5e1d0c8a7f42
Revises: c4a7f0d2e9b1
Create Date: 2026-11-24
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "5e1d0c8a7f42"
down_revision = "c4a7f0d2e9b1"
branch_labels = None
depends_on = None

EMPTY_LIST = sa.text("'[]'::jsonb")


def upgrade() -> None:
    op.add_column("catalog_category", sa.Column("fulfilment", sa.String(length=20), nullable=True))
    op.add_column(
        "catalog_category",
        sa.Column("field_schema", postgresql.JSONB(astext_type=sa.Text()), server_default=EMPTY_LIST, nullable=False),
    )
    op.create_check_constraint(
        op.f("ck_catalog_category_fulfilment_known"),
        "catalog_category",
        "fulfilment IS NULL OR fulfilment IN ('appointment', 'made_to_order')",
    )

    op.add_column(
        "artist_service_item", sa.Column("pricing_unit", sa.String(length=20), server_default="package", nullable=False)
    )
    op.add_column(
        "artist_service_item",
        sa.Column(
            "attributes", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False
        ),
    )
    op.create_check_constraint(
        op.f("ck_artist_service_item_pricing_unit_known"),
        "artist_service_item",
        "pricing_unit IN ('package', 'per_person')",
    )

    op.add_column("booking", sa.Column("quantity", sa.Integer(), server_default="1", nullable=False))
    op.add_column(
        "booking",
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), server_default=EMPTY_LIST, nullable=False),
    )
    op.create_check_constraint(op.f("ck_booking_quantity_positive"), "booking", "quantity >= 1")

    op.add_column("quote_enquiry", sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("quote_enquiry", sa.Column("service_name", sa.String(length=120), nullable=True))
    op.add_column("quote_enquiry", sa.Column("quantity", sa.Integer(), nullable=True))
    op.add_column(
        "quote_enquiry",
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), server_default=EMPTY_LIST, nullable=False),
    )
    op.create_foreign_key(
        op.f("fk_quote_enquiry_service_id_artist_service_item"),
        "quote_enquiry",
        "artist_service_item",
        ["service_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_check_constraint(
        op.f("ck_quote_enquiry_quantity_positive"), "quote_enquiry", "quantity IS NULL OR quantity >= 1"
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_quote_enquiry_quantity_positive"), "quote_enquiry", type_="check")
    op.drop_constraint(op.f("fk_quote_enquiry_service_id_artist_service_item"), "quote_enquiry", type_="foreignkey")
    for column in ("answers", "quantity", "service_name", "service_id"):
        op.drop_column("quote_enquiry", column)
    op.drop_constraint(op.f("ck_booking_quantity_positive"), "booking", type_="check")
    op.drop_column("booking", "answers")
    op.drop_column("booking", "quantity")
    op.drop_constraint(op.f("ck_artist_service_item_pricing_unit_known"), "artist_service_item", type_="check")
    op.drop_column("artist_service_item", "attributes")
    op.drop_column("artist_service_item", "pricing_unit")
    op.drop_constraint(op.f("ck_catalog_category_fulfilment_known"), "catalog_category", type_="check")
    op.drop_column("catalog_category", "field_schema")
    op.drop_column("catalog_category", "fulfilment")
