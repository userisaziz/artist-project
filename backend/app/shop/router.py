import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import current_customer
from app.shared.responses import errors
from app.shop.constants import Category
from app.shop.dependencies import get_order_service, get_product_service, limit_orders
from app.shop.order_service import OrderService
from app.shop.product_service import ProductService
from app.shop.schemas import OrderIn, OrderOut, OrderPage, ProductOut, ProductPage, ReasonIn
from app.user.models import User

# The customer shop. Products off sale (switched off, removed, seller not approved) read as 404.
router = APIRouter(prefix="/shop", tags=["shop"], responses=errors(401, 403, 404, 409, 422, 429))


@router.get("/products", response_model=ProductPage, status_code=200, summary="Products for sale, newest first")
async def list_products(
    category: Category | None = None,
    q: str | None = Query(None, max_length=100),
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = None,
    _: User = Depends(current_customer),
    products: ProductService = Depends(get_product_service),
) -> dict:
    items, next_cursor = await products.catalogue(category, q, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/products/{product_id}", response_model=ProductOut, status_code=200, summary="One product")
async def get_product(
    product_id: uuid.UUID, _: User = Depends(current_customer), products: ProductService = Depends(get_product_service)
) -> dict:
    return await products.detail(product_id)


@router.post(
    "/orders",
    response_model=list[OrderOut],
    status_code=201,
    summary="Place an order (one per artist)",
    dependencies=[Depends(limit_orders)],
)
async def place_order(
    body: OrderIn, user: User = Depends(current_customer), orders: OrderService = Depends(get_order_service)
) -> list[dict]:
    return await orders.place(user, body)


@router.get("/orders", response_model=OrderPage, status_code=200, summary="My orders, newest first")
async def list_my_orders(
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = None,
    user: User = Depends(current_customer),
    orders: OrderService = Depends(get_order_service),
) -> dict:
    items, next_cursor = await orders.mine(user, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/orders/{order_id}", response_model=OrderOut, status_code=200, summary="One of my orders")
async def get_my_order(
    order_id: uuid.UUID, user: User = Depends(current_customer), orders: OrderService = Depends(get_order_service)
) -> dict:
    return await orders.my_order(user, order_id)


@router.post("/orders/{order_id}/cancel", response_model=OrderOut, status_code=200, summary="Cancel before it ships")
async def cancel_my_order(
    order_id: uuid.UUID,
    body: ReasonIn,
    user: User = Depends(current_customer),
    orders: OrderService = Depends(get_order_service),
) -> dict:
    return await orders.customer_cancel(user, order_id, body.reason)
