"""Catalog contracts: the public category tree, and the admin's categories, subcategories and service templates."""

from pydantic import Field

from app.shared.enums import CategoryStatus
from app.shared.schemas import APIModel, ORMModel

SLUG = r"^[a-z0-9]+(-[a-z0-9]+)*$"


class TemplateOut(ORMModel):
    id: int
    name: str
    description: str | None = None


class SubcategoryOut(APIModel):
    id: int
    slug: str
    name: str
    services: list[TemplateOut]


class CatalogCategoryOut(APIModel):
    """The public tree. `CategoryOut` (artists module) stays flat: it is also an artist's own category list."""

    id: int
    slug: str
    name: str
    subcategories: list[SubcategoryOut]


class CategoryIn(APIModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=50, pattern=SLUG)  # derived from name (and parent) when omitted
    sort_order: int | None = Field(default=None, ge=0)  # appended last among siblings when omitted
    status: CategoryStatus = CategoryStatus.draft  # drafts are admin-only until switched to active
    parent_id: int | None = None  # set → a subcategory of that top-level category


class CategoryPatch(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=50, pattern=SLUG)
    sort_order: int | None = Field(default=None, ge=0)
    status: CategoryStatus | None = None
    parent_id: int | None = None  # an explicit null makes a subcategory top-level


class AdminCategoryOut(ORMModel):
    id: int
    slug: str
    name: str
    sort_order: int
    status: CategoryStatus
    parent_id: int | None
    artist_count: int
    service_count: int
    child_count: int
    template_count: int


class TemplateIn(APIModel):
    subcategory_id: int
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    sort_order: int | None = Field(default=None, ge=0)  # appended last when omitted
    is_active: bool = True


class TemplatePatch(APIModel):
    """No subcategory_id: a template stays where it was created."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)  # an explicit null clears it
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class AdminTemplateOut(APIModel):
    id: int
    subcategory_id: int
    name: str
    description: str | None
    sort_order: int
    is_active: bool
    artist_count: int


class AreaOut(ORMModel):
    id: int
    city: str
    name: str
    latitude: float  # the area's rough centre, for the map; never an artist's own pin
    longitude: float
