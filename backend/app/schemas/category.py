"""Admin contracts for managing categories (the public list is `CategoryOut` in schemas/artist.py)."""

from pydantic import BaseModel, ConfigDict, Field

SLUG = r"^[a-z0-9]+(-[a-z0-9]+)*$"


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=50, pattern=SLUG)  # derived from name when omitted
    sort_order: int | None = Field(default=None, ge=0)  # appended last when omitted
    is_active: bool = True


class CategoryPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=50, pattern=SLUG)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class AdminCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    sort_order: int
    is_active: bool
    artist_count: int
    service_count: int
