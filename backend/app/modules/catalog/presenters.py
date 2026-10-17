"""Pure mappers from catalog models to response schemas."""

from collections import defaultdict

from app.modules.catalog.schemas import (
    AdminCategoryOut,
    AdminTemplateOut,
    CatalogCategoryOut,
    SubcategoryOut,
    TemplateOut,
)
from app.modules.catalog.service import Catalog, CategoryUsage
from app.modules.catalog.template_service import TemplateUsage


def category_out(row: CategoryUsage) -> AdminCategoryOut:
    category, u = row
    return AdminCategoryOut(
        id=category.id, slug=category.slug, name=category.name, sort_order=category.sort_order,
        status=category.status, parent_id=category.parent_id, artist_count=u.artists,
        service_count=u.services, child_count=u.children, template_count=u.templates,
    )


def template_out(row: TemplateUsage) -> AdminTemplateOut:
    template, artist_count = row
    return AdminTemplateOut(
        id=template.id, subcategory_id=template.subcategory_id, name=template.name,
        description=template.description, sort_order=template.sort_order,
        is_active=template.is_active, artist_count=artist_count,
    )


def catalog_tree(catalog: Catalog) -> list[CatalogCategoryOut]:
    """Active categories → active subcategories → active services. Hiding a level hides everything under it."""
    services: dict[int, list[TemplateOut]] = defaultdict(list)
    for template in catalog.templates:
        services[template.subcategory_id].append(TemplateOut.model_validate(template))
    subcategories: dict[int, list[SubcategoryOut]] = defaultdict(list)
    for c in catalog.categories:
        if c.parent_id is not None:
            subcategories[c.parent_id].append(SubcategoryOut(id=c.id, slug=c.slug, name=c.name, services=services[c.id]))
    return [
        CatalogCategoryOut(id=c.id, slug=c.slug, name=c.name, subcategories=subcategories[c.id])
        for c in catalog.categories if c.parent_id is None
    ]
