"""Pure mappers from catalog models to response-shaped dicts (the route's response_model validates them once)."""

from collections import defaultdict

from app.catalog.service import Catalog, CategoryUsage
from app.catalog.template import TemplateUsage


def category_out(row: CategoryUsage) -> dict:
    category, u = row
    return dict(
        id=category.id,
        slug=category.slug,
        name=category.name,
        sort_order=category.sort_order,
        status=category.status,
        parent_id=category.parent_id,
        artist_count=u.artists,
        service_count=u.services,
        child_count=u.children,
        template_count=u.templates,
    )


def template_out(row: TemplateUsage) -> dict:
    template, artist_count = row
    return dict(
        id=template.id,
        subcategory_id=template.subcategory_id,
        name=template.name,
        description=template.description,
        sort_order=template.sort_order,
        is_active=template.is_active,
        artist_count=artist_count,
    )


def catalog_tree(catalog: Catalog) -> list[dict]:
    """Active categories → active subcategories → active services. Hiding a level hides everything under it."""
    services: dict[int, list] = defaultdict(list)
    for template in catalog.templates:
        services[template.subcategory_id].append(template)
    subcategories: dict[int, list[dict]] = defaultdict(list)
    for c in catalog.categories:
        if c.parent_id is not None:
            subcategories[c.parent_id].append({"id": c.id, "slug": c.slug, "name": c.name, "services": services[c.id]})
    return [
        {"id": c.id, "slug": c.slug, "name": c.name, "subcategories": subcategories[c.id]}
        for c in catalog.categories
        if c.parent_id is None
    ]
