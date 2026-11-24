"""Per-unit pricing: services priced per person, piece, box, card, hour or set, with a minimum quantity; a default
unit per category; enquiries keep their picked add-ons and the extra services asked about. Per-person services
become per unit "person".

Revision ID: 8b2f6a1c9d03
Revises: 5e1d0c8a7f42
Create Date: 2026-11-24
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "8b2f6a1c9d03"
down_revision = "5e1d0c8a7f42"
branch_labels = None
depends_on = None

UNITS = "('person', 'piece', 'box', 'card', 'hour', 'set')"
EMPTY_LIST = sa.text("'[]'::jsonb")


def upgrade() -> None:
    op.add_column("artist_service_item", sa.Column("quantity_unit", sa.String(length=10), nullable=True))
    op.add_column("artist_service_item", sa.Column("min_quantity", sa.Integer(), server_default="1", nullable=False))
    op.drop_constraint(op.f("ck_artist_service_item_pricing_unit_known"), "artist_service_item", type_="check")
    op.execute(
        "UPDATE artist_service_item SET pricing_unit = 'per_unit', quantity_unit = 'person' "
        "WHERE pricing_unit = 'per_person'"
    )
    op.create_check_constraint(
        op.f("ck_artist_service_item_pricing_unit_known"),
        "artist_service_item",
        "pricing_unit IN ('package', 'per_unit')",
    )
    op.create_check_constraint(
        op.f("ck_artist_service_item_quantity_matches_pricing"),
        "artist_service_item",
        "(pricing_unit = 'package' AND quantity_unit IS NULL AND min_quantity = 1) OR "
        f"(pricing_unit = 'per_unit' AND quantity_unit IN {UNITS} AND min_quantity >= 1)",
    )

    op.add_column("catalog_category", sa.Column("default_unit", sa.String(length=10), nullable=True))
    op.create_check_constraint(
        op.f("ck_catalog_category_default_unit_known"),
        "catalog_category",
        f"default_unit IS NULL OR default_unit IN {UNITS}",
    )

    for column in ("addons", "also_services"):
        op.add_column(
            "quote_enquiry",
            sa.Column(column, postgresql.JSONB(astext_type=sa.Text()), server_default=EMPTY_LIST, nullable=False),
        )


def downgrade() -> None:
    op.drop_column("quote_enquiry", "also_services")
    op.drop_column("quote_enquiry", "addons")
    op.drop_constraint(op.f("ck_catalog_category_default_unit_known"), "catalog_category", type_="check")
    op.drop_column("catalog_category", "default_unit")
    op.drop_constraint(op.f("ck_artist_service_item_quantity_matches_pricing"), "artist_service_item", type_="check")
    op.drop_constraint(op.f("ck_artist_service_item_pricing_unit_known"), "artist_service_item", type_="check")
    # Only per-person units map back; other per-unit services return to package pricing.
    op.execute(
        "UPDATE artist_service_item SET pricing_unit = CASE WHEN quantity_unit = 'person' THEN 'per_person' "
        "ELSE 'package' END WHERE pricing_unit = 'per_unit'"
    )
    op.create_check_constraint(
        op.f("ck_artist_service_item_pricing_unit_known"),
        "artist_service_item",
        "pricing_unit IN ('package', 'per_person')",
    )
    op.drop_column("artist_service_item", "min_quantity")
    op.drop_column("artist_service_item", "quantity_unit")
