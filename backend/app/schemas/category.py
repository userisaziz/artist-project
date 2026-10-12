"""Admin contracts for managing categories and subcategories (the public tree is `CatalogCategoryOut` in schemas/artist.py)."""

from pydantic import BaseModel, ConfigDict, Field

SLUG = r"^[a-z0-9]+(-[a-z0-9]+)*$"


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=50, pattern=SLUG)  # derived from name (and parent) when omitted
    sort_order: int | None = Field(default=None, ge=0)  # appended last among siblings when omitted
    is_active: bool = True
    parent_id: int | None = None  # set → a subcategory of that top-level category


class CategoryPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=50, pattern=SLUG)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    parent_id: int | None = None  # an explicit null makes a subcategory top-level


class AdminCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    sort_order: int
    is_active: bool
    parent_id: int | None
    artist_count: int
    service_count: int
    child_count: int
    template_count: int
