"""Shop queries: product rows with seller and units sold, order rows with seller and customer, counts."""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import NamedTuple

from sqlalchemy import ColumnElement, Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.shared.enums import ArtistStatus
from app.shared.pagination import keyset
from app.shop.constants import LOW_STOCK, OPEN_ORDER, OrderStatus, ProductStatus
from app.shop.models import Order, OrderItem, Product, ProductPhoto, ShopSettings
from app.user.models import User

SELLER_APPROVED = ArtistProfile.status == ArtistStatus.approved
ON_SALE = and_(Product.status == ProductStatus.live, Product.is_active.is_(True), SELLER_APPROVED)
LOW = and_(Product.status == ProductStatus.live, Product.stock <= LOW_STOCK)
SOLD = (
    select(func.coalesce(func.sum(OrderItem.quantity), 0))
    .join(Order, Order.id == OrderItem.order_id)
    .where(OrderItem.product_id == Product.id, Order.status != OrderStatus.cancelled)
    .scalar_subquery()
)


class ProductRow(NamedTuple):
    product: Product
    seller: ArtistProfile
    settings: ShopSettings | None
    sold: int


class OrderRow(NamedTuple):
    order: Order
    seller: ArtistProfile
    customer: User


def product_rows() -> Select:
    return (
        select(Product, ArtistProfile, ShopSettings, SOLD)
        .join(ArtistProfile, ArtistProfile.id == Product.artist_id)
        .outerjoin(ShopSettings, ShopSettings.artist_id == Product.artist_id)
    )


def order_rows() -> Select:
    return (
        select(Order, ArtistProfile, User)
        .join(ArtistProfile, ArtistProfile.id == Order.artist_id)
        .join(User, User.id == Order.customer_id)
    )


class ShopRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # --- settings and products ------------------------------------------------------------------

    async def settings(self, artist_id: uuid.UUID) -> ShopSettings | None:
        return await self.session.get(ShopSettings, artist_id)

    async def product_page(
        self, where: Sequence[ColumnElement[bool]], *, limit: int, cursor: str | None
    ) -> list[ProductRow]:
        query = keyset(product_rows().where(*where), Product.created_at, Product.id, descending=True, cursor=cursor)
        return [ProductRow(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]

    async def product_row(self, product_id: uuid.UUID, *scope: ColumnElement[bool]) -> ProductRow | None:
        row = (await self.session.execute(product_rows().where(Product.id == product_id, *scope))).one_or_none()
        return ProductRow(*row) if row else None

    async def own_product(self, product_id: uuid.UUID, artist_id: uuid.UUID) -> Product | None:
        return await self.session.scalar(
            select(Product).where(Product.id == product_id, Product.artist_id == artist_id).with_for_update()
        )

    async def locked_products(self, product_ids: list[uuid.UUID]) -> list[tuple[Product, ShopSettings | None]]:
        """The products being ordered, locked in id order (no deadlocks), with their seller's settings."""
        rows = await self.session.execute(
            select(Product, ShopSettings)
            .join(ArtistProfile, ArtistProfile.id == Product.artist_id)
            .outerjoin(ShopSettings, ShopSettings.artist_id == Product.artist_id)
            .where(Product.id.in_(product_ids), ON_SALE)
            .order_by(Product.id)
            .with_for_update(of=Product)
        )
        return [tuple(r) for r in rows.all()]

    async def product(self, product_id: uuid.UUID) -> Product | None:
        return await self.session.scalar(select(Product).where(Product.id == product_id).with_for_update())

    async def photo_key_taken(self, keys: list[str]) -> bool:
        found = await self.session.scalar(select(ProductPhoto.id).where(ProductPhoto.storage_key.in_(keys)).limit(1))
        return found is not None

    async def product_counts(self) -> dict[str, int]:
        row = (
            await self.session.execute(
                select(
                    func.count(),
                    func.count().filter(Product.status == ProductStatus.live),
                    func.count().filter(LOW),
                    func.count().filter(Product.status == ProductStatus.removed),
                ).select_from(Product)
            )
        ).one()
        return {"all": row[0], "live": row[1], "low_stock": row[2], "removed": row[3]}

    async def artist_product_count(self, artist_id: uuid.UUID) -> int:
        return await self.session.scalar(select(func.count()).where(Product.artist_id == artist_id))

    # --- orders -----------------------------------------------------------------------------------

    async def order_page(
        self, where: Sequence[ColumnElement[bool]], *, limit: int, cursor: str | None
    ) -> list[OrderRow]:
        query = keyset(order_rows().where(*where), Order.created_at, Order.id, descending=True, cursor=cursor)
        return [OrderRow(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]

    async def order_row(self, order_id: uuid.UUID, *scope: ColumnElement[bool]) -> OrderRow | None:
        row = (await self.session.execute(order_rows().where(Order.id == order_id, *scope))).one_or_none()
        return OrderRow(*row) if row else None

    async def locked_order(self, order_id: uuid.UUID, *scope: ColumnElement[bool]) -> Order | None:
        return await self.session.scalar(
            select(Order)
            .where(Order.id == order_id, *scope)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    async def products_by_id(self, ids: list[uuid.UUID]) -> dict[uuid.UUID, Product]:
        if not ids:
            return {}
        return {p.id: p for p in await self.session.scalars(select(Product).where(Product.id.in_(ids)))}

    async def code_taken(self, code: str) -> bool:
        return await self.session.scalar(select(Order.id).where(Order.code == code)) is not None

    async def order_counts(self, *scope: ColumnElement[bool]) -> dict[str, int]:
        row = (
            await self.session.execute(
                select(
                    func.count(),
                    func.count().filter(Order.status.in_(OPEN_ORDER)),
                    func.count().filter(Order.status == OrderStatus.shipped),
                    func.count().filter(Order.status == OrderStatus.delivered),
                    func.count().filter(Order.status == OrderStatus.cancelled),
                ).where(*scope)
            )
        ).one()
        return {"all": row[0], "to_pack": row[1], "shipped": row[2], "delivered": row[3], "cancelled": row[4]}

    async def month_sales(self, artist_id: uuid.UUID, since: datetime) -> tuple[int, int]:
        row = (
            await self.session.execute(
                select(func.count(), func.coalesce(func.sum(Order.total_paise), 0)).where(
                    Order.artist_id == artist_id, Order.created_at >= since, Order.status != OrderStatus.cancelled
                )
            )
        ).one()
        return row[0], row[1]

    def add(self, row) -> None:
        self.session.add(row)
