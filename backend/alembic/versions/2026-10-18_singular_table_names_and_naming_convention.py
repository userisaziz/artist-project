"""Singular, module-prefixed table names and the explicit MetaData naming convention.

Renames every table (users -> user_account, bookings -> booking, ...) and every constraint, index and
sequence to the convention in app/shared/models.py. Pure renames: no data moves, fully reversible.

Revision ID: 9c1e5a7b3d20
Revises: b4c6d8e0f2a3
Create Date: 2026-10-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "9c1e5a7b3d20"
down_revision: str | Sequence[str] | None = "b4c6d8e0f2a3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# old table -> new table
TABLES = [
    ("users", "user_account"),
    ("user_roles", "user_role_grant"),
    ("otp_codes", "auth_otp_code"),
    ("refresh_tokens", "auth_refresh_token"),
    ("categories", "catalog_category"),
    ("service_templates", "catalog_service_template"),
    ("artist_profiles", "artist_profile"),
    ("artist_categories", "artist_category"),
    ("artist_services", "artist_service_item"),
    ("portfolio_photos", "artist_portfolio_photo"),
    ("aadhaar_reveals", "artist_aadhaar_reveal"),
    ("bookings", "booking"),
    ("reviews", "review"),
]

# (table, after the rename) -> old constraint name -> new constraint name
CONSTRAINTS = [
    ("artist_aadhaar_reveal", "aadhaar_reveals_admin_id_fkey", "fk_artist_aadhaar_reveal_admin_id_user_account"),
    ("artist_aadhaar_reveal", "aadhaar_reveals_artist_id_fkey", "fk_artist_aadhaar_reveal_artist_id_artist_profile"),
    ("artist_aadhaar_reveal", "aadhaar_reveals_pkey", "pk_artist_aadhaar_reveal"),
    ("artist_category", "artist_categories_artist_id_fkey", "fk_artist_category_artist_id_artist_profile"),
    ("artist_category", "artist_categories_category_id_fkey", "fk_artist_category_category_id_catalog_category"),
    ("artist_category", "artist_categories_pkey", "pk_artist_category"),
    ("artist_kyc", "artist_kyc_artist_id_fkey", "fk_artist_kyc_artist_id_artist_profile"),
    ("artist_kyc", "artist_kyc_pkey", "pk_artist_kyc"),
    ("artist_portfolio_photo", "portfolio_photos_artist_id_fkey", "fk_artist_portfolio_photo_artist_id_artist_profile"),
    ("artist_portfolio_photo", "portfolio_photos_pkey", "pk_artist_portfolio_photo"),
    ("artist_profile", "artist_profiles_pkey", "pk_artist_profile"),
    ("artist_profile", "artist_profiles_reviewed_by_fkey", "fk_artist_profile_reviewed_by_user_account"),
    ("artist_profile", "artist_profiles_user_id_fkey", "fk_artist_profile_user_id_user_account"),
    ("artist_profile", "artist_profiles_user_id_key", "uq_artist_profile_user_id"),
    ("artist_service_item", "artist_services_artist_id_fkey", "fk_artist_service_item_artist_id_artist_profile"),
    ("artist_service_item", "artist_services_category_id_fkey", "fk_artist_service_item_category_id_catalog_category"),
    ("artist_service_item", "artist_services_pkey", "pk_artist_service_item"),
    (
        "artist_service_item",
        "artist_services_template_id_fkey",
        "fk_artist_service_item_template_id_catalog_service_template",
    ),
    ("artist_service_item", "ck_artist_services_duration_positive", "ck_artist_service_item_duration_positive"),
    ("artist_service_item", "ck_artist_services_name_or_template", "ck_artist_service_item_name_or_template"),
    ("artist_service_item", "ck_artist_services_price_positive", "ck_artist_service_item_price_positive"),
    ("auth_otp_code", "otp_codes_pkey", "pk_auth_otp_code"),
    ("auth_refresh_token", "refresh_tokens_pkey", "pk_auth_refresh_token"),
    ("auth_refresh_token", "refresh_tokens_token_hash_key", "uq_auth_refresh_token_token_hash"),
    ("auth_refresh_token", "refresh_tokens_user_id_fkey", "fk_auth_refresh_token_user_id_user_account"),
    ("booking", "bookings_artist_id_fkey", "fk_booking_artist_id_artist_profile"),
    ("booking", "bookings_code_key", "uq_booking_code"),
    ("booking", "bookings_customer_id_fkey", "fk_booking_customer_id_user_account"),
    ("booking", "bookings_pkey", "pk_booking"),
    ("booking", "bookings_service_id_fkey", "fk_booking_service_id_artist_service_item"),
    ("booking", "ck_bookings_end_after_start", "ck_booking_end_after_start"),
    ("booking", "ck_bookings_money_non_negative", "ck_booking_money_non_negative"),
    ("catalog_category", "categories_parent_id_fkey", "fk_catalog_category_parent_id_catalog_category"),
    ("catalog_category", "categories_pkey", "pk_catalog_category"),
    ("catalog_category", "categories_slug_key", "uq_catalog_category_slug"),
    ("catalog_service_template", "service_templates_pkey", "pk_catalog_service_template"),
    (
        "catalog_service_template",
        "service_templates_subcategory_id_fkey",
        "fk_catalog_service_template_subcategory_id_catalog_category",
    ),
    ("review", "ck_reviews_rating_range", "ck_review_rating_range"),
    ("review", "reviews_artist_id_fkey", "fk_review_artist_id_artist_profile"),
    ("review", "reviews_booking_id_fkey", "fk_review_booking_id_booking"),
    ("review", "reviews_booking_id_key", "uq_review_booking_id"),
    ("review", "reviews_customer_id_fkey", "fk_review_customer_id_user_account"),
    ("review", "reviews_moderated_by_fkey", "fk_review_moderated_by_user_account"),
    ("review", "reviews_pkey", "pk_review"),
    ("user_account", "ck_users_active_role_not_admin", "ck_user_account_active_role_not_admin"),
    ("user_account", "users_email_key", "uq_user_account_email"),
    ("user_account", "users_phone_key", "uq_user_account_phone"),
    ("user_account", "users_pkey", "pk_user_account"),
    ("user_role_grant", "user_roles_pkey", "pk_user_role_grant"),
    ("user_role_grant", "user_roles_user_id_fkey", "fk_user_role_grant_user_id_user_account"),
]

INDEXES = [
    ("ix_aadhaar_reveals_artist_id", "ix_artist_aadhaar_reveal_artist_id"),
    ("ix_artist_profiles_status_submitted", "ix_artist_profile_status_submitted"),
    ("ix_artist_services_artist_id", "ix_artist_service_item_artist_id"),
    ("ix_artist_services_template_id", "ix_artist_service_item_template_id"),
    ("ix_bookings_artist_id", "ix_booking_artist_id"),
    ("ix_bookings_artist_start", "ix_booking_artist_start"),
    ("ix_bookings_customer_id", "ix_booking_customer_id"),
    ("ix_bookings_status", "ix_booking_status"),
    ("ix_categories_parent_id", "ix_catalog_category_parent_id"),
    ("ix_otp_codes_phone", "ix_auth_otp_code_phone"),
    ("ix_portfolio_photos_artist_id", "ix_artist_portfolio_photo_artist_id"),
    ("ix_reviews_artist_id", "ix_review_artist_id"),
    ("ix_reviews_status", "ix_review_status"),
    ("ix_service_templates_subcategory_id", "ix_catalog_service_template_subcategory_id"),
    ("uq_service_templates_subcategory_name", "uq_catalog_service_template_subcategory_name"),
]

SEQUENCES = [
    ("categories_id_seq", "catalog_category_id_seq"),
    ("service_templates_id_seq", "catalog_service_template_id_seq"),
]


def upgrade() -> None:
    for old, new in TABLES:
        op.rename_table(old, new)
    for table, old, new in CONSTRAINTS:
        op.execute(f'ALTER TABLE "{table}" RENAME CONSTRAINT "{old}" TO "{new}"')
    for old, new in INDEXES:
        op.execute(f'ALTER INDEX "{old}" RENAME TO "{new}"')
    for old, new in SEQUENCES:
        op.execute(f'ALTER SEQUENCE "{old}" RENAME TO "{new}"')


def downgrade() -> None:
    for old, new in reversed(SEQUENCES):
        op.execute(f'ALTER SEQUENCE "{new}" RENAME TO "{old}"')
    for old, new in reversed(INDEXES):
        op.execute(f'ALTER INDEX "{new}" RENAME TO "{old}"')
    for table, old, new in reversed(CONSTRAINTS):
        op.execute(f'ALTER TABLE "{table}" RENAME CONSTRAINT "{new}" TO "{old}"')
    for old, new in reversed(TABLES):
        op.rename_table(new, old)
