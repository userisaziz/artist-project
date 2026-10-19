"""Shop contracts. Prices are what the customer owes, paid outside the app in phase 1."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import Field, StringConstraints

from app.shared.schemas import APIModel
from app.shop.constants import (
    ADDRESS_MAX,
    DESCRIPTION_MAX,
    MAX_ITEMS,
    MAX_PHOTOS,
    MAX_PRICE_PAISE,
    MAX_QUANTITY,
    NAME_MAX,
    REASON_MAX,
    TRACKING_MAX,
    Category,
    OrderStatus,
    PaymentMethod,
    ProductStatus,
)

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=NAME_MAX)]
Price = Annotated[int, Field(gt=0, le=MAX_PRICE_PAISE)]


class SettingsIn(APIModel):
    pay_on_delivery: bool
    pay_before_shipping: bool
    delivery_fee_paise: int = Field(default=0, ge=0, le=MAX_PRICE_PAISE)
    free_delivery_over_paise: int | None = Field(default=None, gt=0, le=MAX_PRICE_PAISE)


class SettingsOut(SettingsIn):
    pass


class PhotoIn(APIModel):
    key: Annotated[str, StringConstraints(min_length=1, max_length=255)]
    width: int = Field(ge=1, le=10000)
    height: int = Field(ge=1, le=10000)


class ProductIn(APIModel):
    name: Name
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=DESCRIPTION_MAX)] | None = None
    category: Category
    price_paise: Price
    mrp_paise: Price | None = None
    stock: int = Field(ge=0, le=100_000)
    photos: list[PhotoIn] = Field(max_length=MAX_PHOTOS)
    payment_methods: list[PaymentMethod] | None = None  # None: the shop default


class ProductPatch(APIModel):
    name: Name | None = None
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=DESCRIPTION_MAX)] | None = None
    price_paise: Price | None = None
    mrp_paise: Price | None = None
    stock: int | None = Field(default=None, ge=0, le=100_000)
    is_active: bool | None = None


class Seller(APIModel):
    id: uuid.UUID
    business_name: str
    city: str
    photo_url: str | None


class ProductPhotoOut(APIModel):
    url: str
    width: int
    height: int


class ProductOut(APIModel):
    id: uuid.UUID
    name: str
    description: str | None
    category: str
    category_label: str
    price_paise: int
    mrp_paise: int | None
    discount_percent: int | None
    stock: int
    photos: list[ProductPhotoOut]
    seller: Seller
    payment_methods: list[PaymentMethod]
    status: ProductStatus
    is_active: bool
    sold: int  # units in orders that weren't cancelled
    removed_reason: str | None
    created_at: datetime


class ProductPage(APIModel):
    items: list[ProductOut]
    next_cursor: str | None


class OrderLineIn(APIModel):
    product_id: uuid.UUID
    quantity: int = Field(ge=1, le=MAX_QUANTITY)


class OrderIn(APIModel):
    items: list[OrderLineIn] = Field(min_length=1, max_length=MAX_ITEMS)
    address: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=ADDRESS_MAX)]
    payment_methods: dict[uuid.UUID, PaymentMethod]  # artist id -> chosen method


class ReasonIn(APIModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=REASON_MAX)] | None = None


class RequiredReasonIn(APIModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=REASON_MAX)]


class ShipIn(APIModel):
    tracking: Annotated[str, StringConstraints(strip_whitespace=True, max_length=TRACKING_MAX)] | None = None


class AdminStatusIn(APIModel):
    status: OrderStatus
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=REASON_MAX)] | None = None


class OrderItemOut(APIModel):
    product_id: uuid.UUID | None
    name: str
    unit_price_paise: int
    quantity: int
    photo_url: str | None


class OrderCustomer(APIModel):
    id: uuid.UUID
    name: str
    phone: str


class OrderEventOut(APIModel):
    status: OrderStatus
    at: datetime


class OrderOut(APIModel):
    id: uuid.UUID
    code: str
    status: OrderStatus
    payment_method: PaymentMethod
    paid_at: datetime | None
    seller: Seller
    customer: OrderCustomer
    address: str
    items: list[OrderItemOut]
    subtotal_paise: int
    delivery_fee_paise: int
    total_paise: int
    tracking: str | None
    cancelled_by: str | None
    cancel_reason: str | None
    created_at: datetime
    timeline: list[OrderEventOut]


class OrderPage(APIModel):
    items: list[OrderOut]
    next_cursor: str | None


class ArtistShopSummary(APIModel):
    to_pack: int
    orders_this_month: int
    sales_this_month_paise: int  # order value this month (not cancelled), paid to the artist outside the app
    products: int


class AdminProductSummary(APIModel):
    counts: dict[str, int]  # all, live, low_stock, removed


class AdminOrderSummary(APIModel):
    counts: dict[str, int]  # all, to_pack, shipped, delivered, cancelled
