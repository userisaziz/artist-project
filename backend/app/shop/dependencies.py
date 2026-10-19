from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import Limit, limit_by_user
from app.shared.clock import Clock, get_clock
from app.shop import constants
from app.shop.order_service import OrderService
from app.shop.product_service import ProductService
from app.upload.service import ImageStorage, get_storage


def get_product_service(
    session: AsyncSession = Depends(get_db, scope="function"), storage: ImageStorage = Depends(get_storage)
) -> ProductService:
    return ProductService(session, storage)


def get_order_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    storage: ImageStorage = Depends(get_storage),
    clock: Clock = Depends(get_clock),
) -> OrderService:
    return OrderService(session, storage, clock)


def orders_per_user() -> Limit:
    return constants.ORDERS_PER_USER


limit_orders = limit_by_user("shop_order", orders_per_user)
