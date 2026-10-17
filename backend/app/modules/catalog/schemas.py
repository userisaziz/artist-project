"""Catalog contracts: the public category tree, and the admin's categories, subcategories and service templates."""

from pydantic import BaseModel, ConfigDict, Field

from app.shared.enums import CategoryStatus

SLUG = r"^[a-z0-9]+(-[a-z0-9]+)*$"


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None


class SubcategoryOut(BaseModel):
    id: int
    slug: str
    name: str
    services: list[TemplateOut]


class CatalogCategoryOut(BaseModel):
    """The public tree. `CategoryOut` (artists module) stays flat: it is also an artist's own category list."""

    id: int
    slug: str
    name: str
    subcategories: list[SubcategoryOut]


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=50, pattern=SLUG)  # derived from name (and parent) when omitted
    sort_order: int | None = Field(default=None, ge=0)  # appended last among siblings when omitted
    status: CategoryStatus = CategoryStatus.draft  # drafts are admin-only until switched to active
    parent_id: int | None = None  # set → a subcategory of that top-level category


class CategoryPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=50, pattern=SLUG)
    sort_order: int | None = Field(default=None, ge=0)
    status: CategoryStatus | None = None
    parent_id: int | None = None  # an explicit null makes a subcategory top-level


class AdminCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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


class TemplateIn(BaseModel):
    subcategory_id: int
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    sort_order: int | None = Field(default=None, ge=0)  # appended last when omitted
    is_active: bool = True


class TemplatePatch(BaseModel):
    """No subcategory_id: a template stays where it was created."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)  # an explicit null clears it
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class AdminTemplateOut(BaseModel):
    id: int
    subcategory_id: int
    name: str
    description: str | None
    sort_order: int
    is_active: bool
    artist_count: int
