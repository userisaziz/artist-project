"""Turning shop rows into response dicts (the routes' response_models validate them)."""

from typing import Any

from app.shop.constants import CATEGORIES, PAYMENT_METHODS
from app.shop.models import Order, Product, ShopSettings
from app.shop.repository import OrderRow, ProductRow
from app.upload.service import ImageStorage
from app.user.models import User

PERCENT = 100


def accepted(product: Product, settings: ShopSettings | None) -> list[str]:
    """The product's own payment methods, else the shop default; nothing until the artist sets their shop up."""
    if product.payment_methods:
        return [m for m in PAYMENT_METHODS if m in product.payment_methods]
    if settings is None:
        return []
    return [m for m in PAYMENT_METHODS if getattr(settings, m)]


def seller_out(seller, storage: ImageStorage) -> dict[str, Any]:
    return {
        "id": seller.id,
        "business_name": seller.business_name,
        "city": seller.city,
        "photo_url": storage.url(seller.photo_key, "thumb") if seller.photo_key else None,
    }


def product_out(row: ProductRow, storage: ImageStorage) -> dict[str, Any]:
    p = row.product
    discount = (
        round((1 - p.price_paise / p.mrp_paise) * PERCENT) if p.mrp_paise and p.mrp_paise > p.price_paise else None
    )
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "category": p.category,
        "category_label": CATEGORIES.get(p.category, p.category),
        "price_paise": p.price_paise,
        "mrp_paise": p.mrp_paise,
        "discount_percent": discount,
        "stock": p.stock,
        "photos": [
            {"url": storage.url(ph.storage_key, "full"), "width": ph.width, "height": ph.height} for ph in p.photos
        ],
        "seller": seller_out(row.seller, storage),
        "payment_methods": accepted(p, row.settings),
        "status": p.status,
        "is_active": p.is_active,
        "sold": row.sold,
        "removed_reason": p.removed_reason,
        "created_at": p.created_at,
    }


def customer_name(user: User) -> str:
    return " ".join(n for n in (user.first_name, user.last_name) if n) or user.phone


def order_out(row: OrderRow, photos: dict, storage: ImageStorage) -> dict[str, Any]:
    o: Order = row.order
    return {
        "id": o.id,
        "code": o.code,
        "status": o.status,
        "payment_method": o.payment_method,
        "paid_at": o.paid_at,
        "seller": seller_out(row.seller, storage),
        "customer": {"id": row.customer.id, "name": customer_name(row.customer), "phone": row.customer.phone},
        "address": o.address,
        "items": [
            {
                "product_id": i.product_id,
                "name": i.name,
                "unit_price_paise": i.unit_price_paise,
                "quantity": i.quantity,
                "photo_url": photos.get(i.product_id),
            }
            for i in o.items
        ],
        "subtotal_paise": o.subtotal_paise,
        "delivery_fee_paise": o.delivery_fee_paise,
        "total_paise": o.total_paise,
        "tracking": o.tracking,
        "cancelled_by": o.cancelled_by,
        "cancel_reason": o.cancel_reason,
        "created_at": o.created_at,
        "timeline": [{"status": e.status, "at": e.at} for e in o.events],
    }
