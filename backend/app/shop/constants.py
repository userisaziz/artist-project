"""Shop vocabulary and limits. Phase 1 has no in-app payments: customers pay on delivery or pay the artist
before shipping, outside the app; each artist chooses which (a shop default a product can override)."""

import enum
from typing import Literal

from app.core.rate_limit import Limit

CATEGORIES: dict[str, str] = {
    "henna": "Henna & aftercare",
    "makeup": "Makeup",
    "hair": "Hair accessories",
    "prints": "Prints & decor",
}
Category = Literal["henna", "makeup", "hair", "prints"]
PaymentMethod = Literal["pay_on_delivery", "pay_before_shipping"]
PAYMENT_METHODS: tuple[str, ...] = ("pay_on_delivery", "pay_before_shipping")
AdminProductView = Literal["all", "live", "low_stock", "removed"]
AdminOrderView = Literal["all", "to_pack", "shipped", "delivered", "cancelled"]
ArtistOrderView = Literal["all", "to_pack", "shipped", "delivered", "cancelled"]

MAX_PHOTOS = 8
NAME_MAX = 120
DESCRIPTION_MAX = 4000
ADDRESS_MAX = 300
REASON_MAX = 500
TRACKING_MAX = 120
LOW_STOCK = 5
MAX_QUANTITY = 20
MAX_ITEMS = 20
MAX_PRICE_PAISE = 10_000_000  # ₹1,00,000

ORDERS_PER_USER = Limit(hits=20, window_seconds=3600)


class ProductStatus(str, enum.Enum):
    """live: sellable (when the artist has it switched on). removed: taken down by an admin."""

    live = "live"
    removed = "removed"


class OrderStatus(str, enum.Enum):
    placed = "placed"
    confirmed = "confirmed"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


OPEN_ORDER = (OrderStatus.placed, OrderStatus.confirmed)  # still to pack: cancellable, stock held
