import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import current_artist
from app.shared.responses import errors
from app.shop.constants import ArtistOrderView
from app.shop.dependencies import get_order_service, get_product_service
from app.shop.order_service import OrderService
from app.shop.product_service import ProductService
from app.shop.schemas import (
    ArtistShopSummary,
    OrderOut,
    OrderPage,
    ProductIn,
    ProductOut,
    ProductPage,
    ProductPatch,
    ReasonIn,
    SettingsIn,
    SettingsOut,
    ShipIn,
)
from app.user.models import User

# An approved artist's shop. Draft, pending, rejected or suspended profiles get 409.
router = APIRouter(prefix="/artists/me/shop", tags=["artist shop"], responses=errors(401, 403, 404, 409, 422))


@router.get("/settings", response_model=SettingsOut, status_code=200, summary="My shop's payment and delivery defaults")
async def get_settings(
    user: User = Depends(current_artist), products: ProductService = Depends(get_product_service)
) -> dict:
    return await products.get_settings(user)


@router.put("/settings", response_model=SettingsOut, status_code=200, summary="Save my shop's defaults")
async def save_settings(
    body: SettingsIn, user: User = Depends(current_artist), products: ProductService = Depends(get_product_service)
) -> dict:
    return await products.save_settings(user, body)


@router.get("/products", response_model=ProductPage, status_code=200, summary="My products, newest first")
async def list_my_products(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(current_artist),
    products: ProductService = Depends(get_product_service),
) -> dict:
    items, next_cursor = await products.mine(user, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.post("/products", response_model=ProductOut, status_code=201, summary="List a product")
async def create_product(
    body: ProductIn, user: User = Depends(current_artist), products: ProductService = Depends(get_product_service)
) -> dict:
    return await products.create(user, body)


@router.patch(
    "/products/{product_id}", response_model=ProductOut, status_code=200, summary="Edit, restock or switch off"
)
async def update_product(
    product_id: uuid.UUID,
    body: ProductPatch,
    user: User = Depends(current_artist),
    products: ProductService = Depends(get_product_service),
) -> dict:
    return await products.update(user, product_id, body)


@router.get("/orders", response_model=OrderPage, status_code=200, summary="Orders for my products, newest first")
async def list_orders(
    view: ArtistOrderView = "all",
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(current_artist),
    orders: OrderService = Depends(get_order_service),
) -> dict:
    items, next_cursor = await orders.artist_orders(user, view, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/summary", response_model=ArtistShopSummary, status_code=200, summary="To pack, and this month's orders")
async def shop_summary(
    user: User = Depends(current_artist),
    orders: OrderService = Depends(get_order_service),
    products: ProductService = Depends(get_product_service),
) -> dict:
    return await orders.artist_summary(user, await products.count_mine(user))


@router.post("/orders/{order_id}/confirm", response_model=OrderOut, status_code=200, summary="Confirm an order")
async def confirm_order(
    order_id: uuid.UUID, user: User = Depends(current_artist), orders: OrderService = Depends(get_order_service)
) -> dict:
    return await orders.artist_step(user, order_id, "confirm")


@router.post(
    "/orders/{order_id}/mark-paid", response_model=OrderOut, status_code=200, summary="Mark paid (outside the app)"
)
async def mark_paid(
    order_id: uuid.UUID, user: User = Depends(current_artist), orders: OrderService = Depends(get_order_service)
) -> dict:
    return await orders.artist_step(user, order_id, "paid")


@router.post("/orders/{order_id}/ship", response_model=OrderOut, status_code=200, summary="Mark shipped")
async def ship_order(
    order_id: uuid.UUID,
    body: ShipIn,
    user: User = Depends(current_artist),
    orders: OrderService = Depends(get_order_service),
) -> dict:
    return await orders.artist_step(user, order_id, "ship", body.tracking)


@router.post("/orders/{order_id}/deliver", response_model=OrderOut, status_code=200, summary="Mark delivered")
async def deliver_order(
    order_id: uuid.UUID, user: User = Depends(current_artist), orders: OrderService = Depends(get_order_service)
) -> dict:
    return await orders.artist_step(user, order_id, "deliver")


@router.post("/orders/{order_id}/cancel", response_model=OrderOut, status_code=200, summary="Cancel before shipping")
async def cancel_order(
    order_id: uuid.UUID,
    body: ReasonIn,
    user: User = Depends(current_artist),
    orders: OrderService = Depends(get_order_service),
) -> dict:
    return await orders.artist_step(user, order_id, "cancel", body.reason)
