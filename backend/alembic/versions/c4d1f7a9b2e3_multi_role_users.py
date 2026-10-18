"""multi-role users

Revision ID: c4d1f7a9b2e3
Revises: 265eeb13be2d
Create Date: 2026-10-10 21:30:00.000000

One account can now hold several roles (customer, artist, admin) in user_roles.
users.role becomes users.active_role: the side of the mobile app being shown
(customer/artist, never admin; NULL until Choose role, which replaces is_onboarded).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "c4d1f7a9b2e3"
down_revision: str | Sequence[str] | None = "265eeb13be2d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

user_role = postgresql.ENUM("customer", "artist", "admin", name="user_role", create_type=False)


def upgrade() -> None:
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "role"),
    )
    # Existing grants: the role picked on Choose role, or admin (set by make_admin).
    op.execute("INSERT INTO user_roles (user_id, role) SELECT id, role FROM users WHERE is_onboarded OR role = 'admin'")

    op.alter_column("users", "role", new_column_name="active_role", server_default=None, nullable=True)
    op.execute("UPDATE users SET active_role = NULL WHERE NOT is_onboarded OR active_role = 'admin'")
    op.create_check_constraint("ck_users_active_role_not_admin", "users", "active_role <> 'admin'")
    op.drop_column("users", "is_onboarded")


def downgrade() -> None:
    op.add_column("users", sa.Column("is_onboarded", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.execute("UPDATE users SET is_onboarded = active_role IS NOT NULL")
    op.drop_constraint("ck_users_active_role_not_admin", "users", type_="check")
    # One role per user again: admin wins, then the active role, else customer.
    op.execute(
        "UPDATE users u SET active_role = CASE "
        "WHEN EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin') THEN 'admin' "
        "ELSE COALESCE(u.active_role, 'customer') END"
    )
    op.execute("UPDATE users SET is_onboarded = true WHERE active_role = 'admin'")
    op.alter_column(
        "users", "active_role", new_column_name="role", server_default=sa.text("'customer'"), nullable=False
    )
    op.drop_table("user_roles")
