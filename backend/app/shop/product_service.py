"""Shop products: an approved artist's shop settings and listings, the customer catalogue, admin takedowns.
Only approved artists sell; products of artists who aren't approved (any more) leave the shop."""

import uuid
from typing import Any

from sqlalchemy import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.booking.service import approved_artist_id
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.review import filters as review_filters
from app.shared.pagination import split_page
from app.shared.search import like_pattern
from app.shop.constants import AdminProductView, Category, ProductStatus
from app.shop.models import Product, ProductPhoto, ShopSettings
from app.shop.repository import LOW, ON_SALE, ShopRepository
from app.shop.schemas import ProductIn, ProductPatch, SettingsIn
from app.shop.shaping import product_out
from app.upload.service import ImageStorage
from app.user.models import User

DEFAULT_SETTINGS = {
    "pay_on_delivery": True,
    "pay_before_shipping": False,
    "delivery_fee_paise": 0,
    "free_delivery_over_paise": None,
}


class ProductService:
    def __init__(self, session: AsyncSession, storage: ImageStorage):
        self.session = session
        self.shop = ShopRepository(session)
        self.storage = storage

    async def _page(self, where: list[ColumnElement[bool]], limit: int, cursor: str | None):
        rows = await self.shop.product_page(where, limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r.product.created_at, r.product.id))
        return [product_out(r, self.storage) for r in page], next_cursor

    async def _out(self, product_id: uuid.UUID, *scope: ColumnElement[bool]) -> dict[str, Any]:
        row = await self.shop.product_row(product_id, *scope)
        if row is None:
            raise NotFoundError("Product not found")
        return product_out(row, self.storage)

    # --- artist -----------------------------------------------------------------------------------

    async def get_settings(self, user: User) -> dict[str, Any]:
        settings = await self.shop.settings(await approved_artist_id(self.session, user))
        if settings is None:
            return DEFAULT_SETTINGS
        return {k: getattr(settings, k) for k in DEFAULT_SETTINGS}

    async def save_settings(self, user: User, data: SettingsIn) -> dict[str, Any]:
        if not (data.pay_on_delivery or data.pay_before_shipping):
            raise ValidationError("Accept at least one way to pay")
        artist_id = await approved_artist_id(self.session, user)
        settings = await self.shop.settings(artist_id)
        if settings is None:
            settings = ShopSettings(artist_id=artist_id, **data.model_dump())
            self.shop.add(settings)
        else:
            for key, value in data.model_dump().items():
                setattr(settings, key, value)
        await self.session.flush()
        return data.model_dump()

    def _check_text(self, *texts: str | None) -> None:
        if review_filters.review_flag("\n".join(t for t in texts if t)):
            raise ValidationError("Listings can't include phone numbers, emails, links or blocked words")

    async def create(self, user: User, data: ProductIn) -> dict[str, Any]:
        artist_id = await approved_artist_id(self.session, user)
        if not data.photos:
            raise ValidationError("Add at least one photo")
        if data.mrp_paise is not None and data.mrp_paise < data.price_paise:
            raise ValidationError("The MRP can't be below the price")
        if data.payment_methods == []:
            raise ValidationError("Accept at least one way to pay, or use your shop default")
        self._check_text(data.name, data.description)
        keys = [p.key for p in data.photos]
        if len(set(keys)) != len(keys) or any(not self.storage.owns(k, user.id, "shop") for k in keys):
            raise ValidationError("Invalid photo")
        if await self.shop.photo_key_taken(keys):
            raise ConflictError("That photo is already used in another listing")
        product = Product(
            artist_id=artist_id,
            name=data.name,
            description=data.description or None,
            category=data.category,
            price_paise=data.price_paise,
            mrp_paise=data.mrp_paise,
            stock=data.stock,
            payment_methods=data.payment_methods,
            photos=[
                ProductPhoto(storage_key=p.key, width=p.width, height=p.height, sort_order=i)
                for i, p in enumerate(data.photos)
            ],
        )
        self.shop.add(product)
        await self.session.flush()
        return await self._out(product.id)

    async def update(self, user: User, product_id: uuid.UUID, data: ProductPatch) -> dict[str, Any]:
        product = await self.shop.own_product(product_id, await approved_artist_id(self.session, user))
        if product is None:
            raise NotFoundError("Product not found")
        changes = data.model_dump(exclude_unset=True)
        self._check_text(changes.get("name"), changes.get("description"))
        for key, value in changes.items():
            setattr(product, key, value)
        if product.mrp_paise is not None and product.mrp_paise < product.price_paise:
            raise ValidationError("The MRP can't be below the price")
        await self.session.flush()
        return await self._out(product_id)

    async def count_mine(self, user: User) -> int:
        return await self.shop.artist_product_count(await approved_artist_id(self.session, user))

    async def mine(self, user: User, limit: int, cursor: str | None):
        artist_id = await approved_artist_id(self.session, user)
        return await self._page([Product.artist_id == artist_id], limit, cursor)

    # --- customer ---------------------------------------------------------------------------------

    async def catalogue(self, category: Category | None, q: str | None, limit: int, cursor: str | None):
        where: list[ColumnElement[bool]] = [ON_SALE]
        if category:
            where.append(Product.category == category)
        if q and q.strip():
            where.append(Product.name.ilike(like_pattern(q), escape="\\"))
        return await self._page(where, limit, cursor)

    async def detail(self, product_id: uuid.UUID) -> dict[str, Any]:
        return await self._out(product_id, ON_SALE)

    # --- admin ------------------------------------------------------------------------------------

    async def admin_list(self, view: AdminProductView, q: str | None, limit: int, cursor: str | None):
        where: list[ColumnElement[bool]] = []
        if view == "live":
            where.append(Product.status == ProductStatus.live)
        elif view == "low_stock":
            where.append(LOW)
        elif view == "removed":
            where.append(Product.status == ProductStatus.removed)
        if q and q.strip():
            where.append(Product.name.ilike(like_pattern(q), escape="\\"))
        return await self._page(where, limit, cursor)

    async def admin_summary(self) -> dict[str, Any]:
        return {"counts": await self.shop.product_counts()}

    async def set_removed(self, product_id: uuid.UUID, removed: bool, reason: str | None) -> dict[str, Any]:
        product = await self.shop.product(product_id)
        if product is None:
            raise NotFoundError("Product not found")
        product.status = ProductStatus.removed if removed else ProductStatus.live
        product.removed_reason = reason if removed else None
        await self.session.flush()
        return await self._out(product_id)
