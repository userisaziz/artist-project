"""One-shot import rewriter for the module-first migration.

Usage: uv run python scripts/migrate_imports.py <domain>
Rewrites old layer-first module paths to new module-first paths across app/
and tests/. Line-listed rewrites run before prefix rewrites (longest first).
Delete this script in the final assembly task.
"""

import re
import sys
from pathlib import Path

# domain -> list of (old_import_string, new_import_string)
DOMAINS: dict[str, list[tuple[str, str]]] = {
    "auth": [
        ("app.routes.auth.auth", "app.auth.router"),
        ("app.controllers.auth.auth", "app.auth.router"),
        ("app.controllers.auth.dependencies", "app.auth.dependencies"),
        ("app.services.auth.auth", "app.auth.service"),
        ("app.services.auth.sms", "app.auth.sms"),
        ("app.repositories.auth.auth", "app.auth.repository"),
        ("app.models.auth.auth", "app.auth.models"),
        ("app.schemas.auth.auth", "app.auth.schemas"),
    ],
    "user": [
        ("app.routes.user.user", "app.user.router"),
        ("app.controllers.user.user", "app.user.router"),
        ("app.controllers.user.dependencies", "app.user.dependencies"),
        ("app.services.user.user", "app.user.service"),
        ("app.repositories.user.user", "app.user.repository"),
        ("app.models.user.user", "app.user.models"),
        ("app.schemas.user.user", "app.user.schemas"),
    ],
    "catalog": [
        ("app.routes.catalog.catalog", "app.catalog.router"),
        ("app.routes.catalog.admin", "app.catalog.admin_router"),
        ("app.controllers.catalog.catalog", "app.catalog.router"),
        ("app.controllers.catalog.admin", "app.catalog.admin_router"),
        ("app.controllers.catalog.dependencies", "app.catalog.dependencies"),
        ("app.controllers.catalog.presenters", "app.catalog.utils"),
        ("app.services.catalog.catalog", "app.catalog.service"),
        ("app.services.catalog.template", "app.catalog.template"),
        ("app.repositories.catalog.catalog", "app.catalog.repository"),
        ("app.models.catalog.catalog", "app.catalog.models"),
        ("app.schemas.catalog.catalog", "app.catalog.schemas"),
    ],
    "artist": [
        ("app.routes.artist.artist", "app.artist.router"),
        ("app.routes.artist.admin", "app.artist.admin_router"),
        ("app.controllers.artist.artist", "app.artist.router"),
        ("app.controllers.artist.admin", "app.artist.admin_router"),
        ("app.controllers.artist.dependencies", "app.artist.dependencies"),
        ("app.controllers.artist.presenters", "app.artist.utils"),
        ("app.services.artist.artist", "app.artist.service"),
        ("app.services.artist.admin", "app.artist.admin_service"),
        ("app.services.artist.aadhaar", "app.artist.aadhaar"),
        ("app.services.artist.custom_service_review", "app.artist.custom_service_review"),
        ("app.repositories.artist.artist", "app.artist.repository"),
        ("app.models.artist.artist", "app.artist.models"),
        ("app.schemas.artist.artist", "app.artist.schemas"),
    ],
    "upload": [
        ("app.routes.upload.upload", "app.upload.router"),
        ("app.controllers.upload.upload", "app.upload.router"),
        ("app.services.upload.storage", "app.upload.service"),
        ("app.schemas.upload.upload", "app.upload.schemas"),
    ],
    "booking": [
        ("from app.services import booking_service", "from app.booking import service as booking_service"),
        ("from app.models import booking", "from app.booking import models as booking"),
        ("from app.utils import booking_rules", "from app.booking import rules as booking_rules"),
        ("app.api.v1.bookings", "app.booking.router"),
        ("app.api.v1.artist_bookings", "app.booking.artist_router"),
        ("app.api.v1.admin_bookings", "app.booking.admin_router"),
        ("app.services.booking_service", "app.booking.service"),
        ("app.services.admin_booking_service", "app.booking.admin_service"),
        ("app.models.booking", "app.booking.models"),
        ("app.schemas.booking", "app.booking.schemas"),
        ("app.utils.booking_rules", "app.booking.rules"),
    ],
    "review": [
        ("from app.services import review_service", "from app.review import service as review_service"),
        ("from app.models import review", "from app.review import models as review"),
        ("from app.utils import review_filter", "from app.review import filters as review_filter"),
        ("app.api.v1.artist_reviews", "app.review.artist_router"),
        ("app.api.v1.admin_reviews", "app.review.admin_router"),
        ("app.services.review_service", "app.review.service"),
        ("app.models.review", "app.review.models"),
        ("app.schemas.review", "app.review.schemas"),
        ("app.utils.review_filter", "app.review.filters"),
    ],
    "directory": [
        ("from app.services import directory_service", "from app.directory import service as directory_service"),
        ("app.api.v1.directory", "app.directory.router"),
        ("app.services.directory_service", "app.directory.service"),
        ("app.schemas.directory", "app.directory.schemas"),
    ],
    "shared": [
        ("app.schemas.common", "app.shared.schemas"),
    ],
}

TARGETS = ["app", "tests"]


def rewrite_file(path: Path, pairs: list[tuple[str, str]]) -> None:
    text = path.read_text()
    original = text
    for old, new in sorted(pairs, key=lambda p: -len(p[0])):
        if old.startswith("from "):  # full-line style rewrite
            text = text.replace(old, new)
        else:
            text = re.sub(rf"\b{re.escape(old)}\b", new, text)
    if text != original:
        path.write_text(text)


def main(domain: str) -> None:
    pairs = DOMAINS[domain]
    root = Path.cwd()
    for target in TARGETS:
        for py in (root / target).rglob("*.py"):
            if "__pycache__" not in str(py):
                rewrite_file(py, pairs)
    print(f"rewrote imports for domain: {domain}")


if __name__ == "__main__":
    main(sys.argv[1])
