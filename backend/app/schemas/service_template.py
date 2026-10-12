"""Admin contracts for the service list under each subcategory."""

from pydantic import BaseModel, Field


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
