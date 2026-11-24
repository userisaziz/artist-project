"""Per-category service rules: how a category is fulfilled and the extra fields its services carry.

Admins define them on a category or subcategory (no release needed for a new category). A subcategory inherits its
parent's fulfilment unless it sets its own, and its fields come after its parent's. Fields have two scopes:

* ``listing`` — what the artist states when offering a listed service ("Edited photos: 300").
* ``booking`` — what the customer answers when booking or asking for a quote ("Baby's name").

Values live in JSONB (``artist_service_item.attributes``; bookings and enquiries keep an ``answers`` snapshot with
the labels, so later schema edits never rewrite history) and are validated here against the schema.
"""

from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import Any

from pydantic import Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Category
from app.core.exceptions import ValidationError
from app.shared.schemas import APIModel

MAX_FIELDS = 20
MAX_OPTIONS = 20
TEXT_MAX = 300
LONG_TEXT_MAX = 2000
KEY_PATTERN = r"^[a-z][a-z0-9_]{1,39}$"


class Fulfilment(StrEnum):
    """appointment: a time slot at the customer's place or the studio (book now).
    made_to_order: made and handed over later (cards, aqiqah boxes, frames) — customers ask for a quote instead."""

    appointment = "appointment"
    made_to_order = "made_to_order"


class FieldScope(StrEnum):
    listing = "listing"
    booking = "booking"


class FieldType(StrEnum):
    text = "text"
    long_text = "long_text"
    number = "number"
    select = "select"
    multi_select = "multi_select"
    boolean = "boolean"
    date = "date"


CHOICE_TYPES = {FieldType.select, FieldType.multi_select}


class FieldDef(APIModel):
    """One admin-defined field. `key` is the stable id stored with values: keep it once services use it."""

    key: str = Field(pattern=KEY_PATTERN)
    label: str = Field(min_length=1, max_length=60)
    scope: FieldScope
    type: FieldType
    required: bool = False
    options: list[str] = Field(default_factory=list, max_length=MAX_OPTIONS)
    min: float | None = None
    max: float | None = None
    unit: str | None = Field(default=None, max_length=12)
    help: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def _consistent(self) -> "FieldDef":
        self.label = self.label.strip()
        self.options = [o.strip() for o in self.options if o.strip()]
        if self.type in CHOICE_TYPES and not self.options:
            raise ValueError(f"“{self.label}” needs at least one option")
        if self.type not in CHOICE_TYPES and self.options:
            raise ValueError(f"Only choice fields have options (“{self.label}”)")
        if any(len(o) > 40 for o in self.options):
            raise ValueError("Options are at most 40 characters")
        if len(set(o.lower() for o in self.options)) != len(self.options):
            raise ValueError(f"“{self.label}” lists an option twice")
        if self.type != FieldType.number and (self.min is not None or self.max is not None or self.unit):
            raise ValueError(f"Only number fields have a range or unit (“{self.label}”)")
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError(f"“{self.label}”: the minimum is above the maximum")
        return self


class FieldAnswer(APIModel):
    """One answered field as shown and stored: the label as it read when answered, the value and its unit."""

    key: str
    label: str
    value: str | bool | int | float | list[str]
    unit: str | None = None


def check_schema(fields: list[FieldDef], inherited: list[FieldDef] = ()) -> list[FieldDef]:
    """At most MAX_FIELDS, and keys unique within the category and against the parent's."""
    if len(fields) > MAX_FIELDS:
        raise ValidationError(f"A category has at most {MAX_FIELDS} fields")
    keys = [f.key for f in [*inherited, *fields]]
    dupes = sorted({k for k in keys if keys.count(k) > 1})
    if dupes:
        raise ValidationError(f"Field keys must be unique: {', '.join(dupes)}")
    return fields


def parse_schema(raw: list[dict] | None) -> list[FieldDef]:
    """A stored schema back into definitions (it was validated when saved)."""
    return [FieldDef.model_validate(f) for f in raw or []]


@dataclass(frozen=True)
class ServiceRules:
    fulfilment: Fulfilment
    fields: list[FieldDef]
    default_unit: str | None = None  # what per-unit services here are counted in, unless the artist says otherwise

    def scoped(self, scope: FieldScope) -> list[FieldDef]:
        return [f for f in self.fields if f.scope == scope]


def combine(own: dict[str, Any] | None, parent: dict[str, Any] | None) -> ServiceRules:
    """Rules from `{fulfilment, field_schema, default_unit}` rows: the row's own fulfilment and default unit or
    else its parent's (appointment by default), and fields parent-first. Works on ORM rows (see `effective`) and on
    the JSON the directory builds in SQL alike."""
    if own is None:
        return ServiceRules(Fulfilment.appointment, [])
    inherited = parent or {}
    fulfilment = own.get("fulfilment") or inherited.get("fulfilment") or Fulfilment.appointment
    fields = [*parse_schema(inherited.get("field_schema")), *parse_schema(own.get("field_schema"))]
    return ServiceRules(Fulfilment(fulfilment), fields, own.get("default_unit") or inherited.get("default_unit"))


def _row(category: Category | None) -> dict[str, Any] | None:
    if category is None:
        return None
    return {
        "fulfilment": category.fulfilment,
        "field_schema": category.field_schema,
        "default_unit": category.default_unit,
    }


def effective(category: Category | None, parent: Category | None) -> ServiceRules:
    """A (sub)category's rules; see `combine`."""
    return combine(_row(category), _row(parent))


async def rules_for(session: AsyncSession, category_id: int) -> ServiceRules:
    """The rules of the (sub)category a service is filed under."""
    category = await session.get(Category, category_id)
    parent = await session.get(Category, category.parent_id) if category and category.parent_id else None
    return effective(category, parent)


def _clean(f: FieldDef, value: Any) -> Any:
    """One value checked against its field; raises ValidationError with the field's label."""
    bad = ValidationError(f"Check “{f.label}”")
    match f.type:
        case FieldType.text | FieldType.long_text:
            if not isinstance(value, str):
                raise bad
            text = value.strip()
            if len(text) > (TEXT_MAX if f.type == FieldType.text else LONG_TEXT_MAX):
                raise ValidationError(f"“{f.label}” is too long")
            return text
        case FieldType.number:
            if isinstance(value, bool) or not isinstance(value, int | float):
                raise bad
            if (f.min is not None and value < f.min) or (f.max is not None and value > f.max):
                raise ValidationError(
                    f"“{f.label}” must be between {f.min:g} and {f.max:g}"
                    if f.min is not None and f.max is not None
                    else f"Check “{f.label}”"
                )
            return value
        case FieldType.boolean:
            if not isinstance(value, bool):
                raise bad
            return value
        case FieldType.select:
            if value not in f.options:
                raise ValidationError(f"Pick one of the options for “{f.label}”")
            return value
        case FieldType.multi_select:
            if not isinstance(value, list) or any(v not in f.options for v in value):
                raise ValidationError(f"Pick from the options for “{f.label}”")
            return [o for o in f.options if o in value]  # the schema's order, each once
        case FieldType.date:
            try:
                return date.fromisoformat(value).isoformat()
            except (TypeError, ValueError) as exc:
                raise bad from exc
    raise bad  # pragma: no cover - every FieldType is matched above


def _empty(value: Any) -> bool:
    return value is None or value == "" or value == []


def validate_values(fields: list[FieldDef], values: dict[str, Any] | None) -> dict[str, Any]:
    """`values` checked against `fields`: no unknown keys, required ones present, each value well-typed. Empty values
    are dropped, so a stored dict holds only real answers."""
    values = values or {}
    known = {f.key: f for f in fields}
    unknown = sorted(set(values) - set(known))
    if unknown:
        raise ValidationError(f"Unknown fields: {', '.join(unknown)}")
    cleaned: dict[str, Any] = {}
    for f in fields:
        value = values.get(f.key)
        if _empty(value) or (isinstance(value, str) and not value.strip()):
            if f.required:
                raise ValidationError(f"“{f.label}” is required")
            continue
        cleaned[f.key] = _clean(f, value)
    return cleaned


def answer_snapshot(fields: list[FieldDef], values: dict[str, Any]) -> list[dict[str, Any]]:
    """Validated values as `[{key, label, value, unit}]` in the schema's order: what a booking or enquiry keeps."""
    return [{"key": f.key, "label": f.label, "value": values[f.key], "unit": f.unit} for f in fields if f.key in values]
