"""The public catalog's cache: the category tree, and each operating city's areas.

Both are read by nearly every screen and change only when an admin edits them, so they are kept in
process memory for a short while. A hit costs no database round trip at all.

The cache drops itself when the catalog changes, and it drops itself **after** the change is
committed: a transaction that writes a category, a service template or an area is noticed here, and
the copy in memory is thrown away once the transaction commits. Two things follow from that.

* No write path can leave the catalog stale. The watch is on the session, not on the route, so an
  admin action added later is covered without anyone remembering to invalidate anything.
* The drop happens at commit time, not at write time. A read that starts before the commit would
  otherwise put the old catalog back into the cache, and the stale copy would outlive the edit.
"""

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.catalog.config import get_catalog_settings
from app.catalog.models import Area, Category, ServiceTemplate
from app.catalog.service import AreaService, CategoryService
from app.catalog.utils import area_out, catalog_tree
from app.core.cache import TTLCache

TREE_KEY = "catalog-tree"
AREA_PREFIX = "areas:"

TREE = TTLCache[list[dict]](ttl_seconds=get_catalog_settings().cache_ttl_seconds)
AREAS = TTLCache[list[dict]](ttl_seconds=get_catalog_settings().cache_ttl_seconds)

# The tables the public catalog is built from. A transaction that writes one of them drops the cache.
CATALOG_TABLES = frozenset({Category.__tablename__, ServiceTemplate.__tablename__, Area.__tablename__})


@event.listens_for(Session, "before_flush")
def _note_catalog_writes(session: Session, _flush_context, _instances) -> None:
    """Remember that this request is about to write to a table the public catalog is built from."""
    for obj in session.new | session.dirty | session.deleted:
        if getattr(obj, "__tablename__", None) in CATALOG_TABLES:
            session.info["catalog_changed"] = True
            return


@event.listens_for(Session, "after_commit")
def _drop_the_catalog(session: Session) -> None:
    """The write is in: whatever was cached about the catalog is out of date now."""
    if session.info.pop("catalog_changed", False):
        invalidate_catalog()


async def catalog_tree_cached(service: CategoryService) -> list[dict]:
    """The public category tree, cached for a short while."""
    return await TREE.get_or_load(TREE_KEY, lambda: _tree(service))


async def _tree(service: CategoryService) -> list[dict]:
    return catalog_tree(await service.catalog())


async def city_areas_cached(service: AreaService, city: str) -> list[dict]:
    """A city's areas, cached for a short while.

    Only the operating cities are cached: they are a known, small set, which keeps the cache — and
    the memory behind it — bounded whatever city names a caller sends.
    """
    if city not in get_catalog_settings().cities:
        return await _areas(service, city)
    return await AREAS.get_or_load(f"{AREA_PREFIX}{city}", lambda: _areas(service, city))


async def _areas(service: AreaService, city: str) -> list[dict]:
    return [area_out(area) for area in await service.in_city(city)]


def invalidate_catalog() -> None:
    """Forget the cached catalog: the category tree, and every city's areas."""
    TREE.invalidate(TREE_KEY)
    AREAS.clear()
