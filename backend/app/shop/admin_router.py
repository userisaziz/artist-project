import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import audited_admin
from app.shared.responses import errors
from app.shop.constants import AdminOrderView, AdminProductView
from app.shop.dependencies import get_order_service, get_product_service
from app.shop.order_service import OrderService
from app.shop.product_service import ProductService
from app.shop.schemas import (
    AdminOrderSummary,
    AdminProductSummary,
    AdminStatusIn,
    OrderOut,
    OrderPage,
    ProductOut,
    ProductPage,
    RequiredReasonIn,
)

router = APIRouter(
    prefix="/admin/shop",
    tags=["admin shop"],
    dependencies=[Depends(audited_admin)],
    responses=errors(401, 403, 404, 409, 422),
)


@router.get("/products", response_model=ProductPage, status_code=200, summary="Every listing, newest first")
async def list_products(
    view: AdminProductView = "all",
    q: str | None = Query(None, max_length=100),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    products: ProductService = Depends(get_product_service),
) -> dict:
    items, next_cursor = await products.admin_list(view, q, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/products/summary", response_model=AdminProductSummary, status_code=200, summary="Listing counts")
async def product_summary(products: ProductService = Depends(get_product_service)) -> dict:
    return await products.admin_summary()


@router.post("/products/{product_id}/remove", response_model=ProductOut, status_code=200, summary="Take a listing down")
async def remove_product(
    product_id: uuid.UUID, body: RequiredReasonIn, products: ProductService = Depends(get_product_service)
) -> dict:
    return await products.set_removed(product_id, True, body.reason)


@router.post("/products/{product_id}/restore", response_model=ProductOut, status_code=200, summary="Put a listing back")
async def restore_product(product_id: uuid.UUID, products: ProductService = Depends(get_product_service)) -> dict:
    return await products.set_removed(product_id, False, None)


@router.get("/orders", response_model=OrderPage, status_code=200, summary="Every order, newest first")
async def list_orders(
    view: AdminOrderView = "all",
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    orders: OrderService = Depends(get_order_service),
) -> dict:
    items, next_cursor = await orders.admin_list(view, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/orders/summary", response_model=AdminOrderSummary, status_code=200, summary="Order counts")
async def order_summary(orders: OrderService = Depends(get_order_service)) -> dict:
    return await orders.admin_summary()


@router.post(
    "/orders/{order_id}/status", response_model=OrderOut, status_code=200, summary="Move an order on, or cancel it"
)
async def set_order_status(
    order_id: uuid.UUID, body: AdminStatusIn, orders: OrderService = Depends(get_order_service)
) -> dict:
    return await orders.admin_set_status(order_id, body.status, body.reason)
