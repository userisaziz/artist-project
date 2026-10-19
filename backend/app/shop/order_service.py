"""Shop orders. A checkout becomes one order per artist (each packs and ships their own items), paid the way
the customer picked from what that artist and those products accept, outside the app. Stock is held when the
order is placed and given back if it's cancelled before shipping."""

import secrets
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.booking.repository import BookingRepository
from app.booking.service import approved_artist_id
from app.core.exceptions import ConflictError, NotFoundError
from app.shared.clock import Clock
from app.shared.pagination import split_page
from app.shop.constants import OPEN_ORDER, AdminOrderView, ArtistOrderView, OrderStatus
from app.shop.models import Order, OrderEvent, OrderItem, Product, ShopSettings
from app.shop.repository import ShopRepository
from app.shop.schemas import OrderIn
from app.shop.shaping import accepted, order_out
from app.upload.service import ImageStorage
from app.user.models import User

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_TRIES = 5
NEXT = {
    OrderStatus.placed: OrderStatus.confirmed,
    OrderStatus.confirmed: OrderStatus.shipped,
    OrderStatus.shipped: OrderStatus.delivered,
}


def delivery_fee(settings: ShopSettings | None, subtotal: int) -> int:
    if settings is None:
        return 0
    if settings.free_delivery_over_paise and subtotal >= settings.free_delivery_over_paise:
        return 0
    return settings.delivery_fee_paise


def view_filter(view: AdminOrderView | ArtistOrderView) -> list[ColumnElement[bool]]:
    return {
        "all": [],
        "to_pack": [Order.status.in_(OPEN_ORDER)],
        "shipped": [Order.status == OrderStatus.shipped],
        "delivered": [Order.status == OrderStatus.delivered],
        "cancelled": [Order.status == OrderStatus.cancelled],
    }[view]


class OrderService:
    def __init__(self, session: AsyncSession, storage: ImageStorage, clock: Clock):
        self.session = session
        self.shop = ShopRepository(session)
        self.storage = storage
        self.clock = clock

    # --- shaping ----------------------------------------------------------------------------------

    async def _photos(self, orders: list[Order]) -> dict[uuid.UUID, str]:
        ids = list({i.product_id for o in orders for i in o.items if i.product_id})
        products = await self.shop.products_by_id(ids)
        return {pid: self.storage.url(p.photos[0].storage_key, "thumb") for pid, p in products.items() if p.photos}

    async def _page(self, where: list[ColumnElement[bool]], limit: int, cursor: str | None):
        rows = await self.shop.order_page(where, limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r.order.created_at, r.order.id))
        photos = await self._photos([r.order for r in page])
        return [order_out(r, photos, self.storage) for r in page], next_cursor

    async def _out(self, order_id: uuid.UUID, *scope: ColumnElement[bool]) -> dict[str, Any]:
        row = await self.shop.order_row(order_id, *scope)
        if row is None:
            raise NotFoundError("Order not found")
        return order_out(row, await self._photos([row.order]), self.storage)

    # --- placing ----------------------------------------------------------------------------------

    async def _code(self) -> str:
        for _ in range(CODE_TRIES):
            code = "AT-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
            if not await self.shop.code_taken(code):
                return code
        raise ConflictError("Couldn't place the order. Please try again.")

    async def place(self, customer: User, data: OrderIn) -> list[dict[str, Any]]:
        quantities: dict[uuid.UUID, int] = defaultdict(int)
        for line in data.items:
            quantities[line.product_id] += line.quantity
        locked = await self.shop.locked_products(list(quantities))
        if len(locked) != len(quantities):
            raise NotFoundError("Something in your cart is no longer for sale")
        own = await self._own_artist_ids(customer)
        by_artist: dict[uuid.UUID, list[tuple[Product, ShopSettings | None]]] = defaultdict(list)
        for product, settings in locked:
            if product.artist_id in own:
                raise ConflictError("You can't order from your own shop")
            if product.stock < quantities[product.id]:
                raise ConflictError(f"Only {product.stock} left of {product.name}")
            by_artist[product.artist_id].append((product, settings))

        now = self.clock.now()
        order_ids = []
        for artist_id, lines in by_artist.items():
            method = data.payment_methods.get(artist_id)
            allowed = set.intersection(*(set(accepted(p, s)) for p, s in lines))
            if method is None or method not in allowed:
                raise ConflictError("Pick a payment method this artist accepts")
            subtotal = sum(p.price_paise * quantities[p.id] for p, _ in lines)
            fee = delivery_fee(lines[0][1], subtotal)
            order = Order(
                code=await self._code(),
                customer_id=customer.id,
                artist_id=artist_id,
                status=OrderStatus.placed,
                payment_method=method,
                address=data.address,
                subtotal_paise=subtotal,
                delivery_fee_paise=fee,
                total_paise=subtotal + fee,
                items=[
                    OrderItem(product_id=p.id, name=p.name, unit_price_paise=p.price_paise, quantity=quantities[p.id])
                    for p, _ in lines
                ],
                events=[OrderEvent(status=OrderStatus.placed, at=now)],
            )
            for p, _ in lines:
                p.stock -= quantities[p.id]
            self.shop.add(order)
            await self.session.flush()
            order_ids.append(order.id)
        return [await self._out(i) for i in order_ids]

    async def _own_artist_ids(self, user: User) -> set[uuid.UUID]:
        """The caller's own artist profile, if they have one: nobody orders from their own shop."""
        artist = await BookingRepository(self.session).artist_of(user.id)
        return {artist.id} if artist else set()

    # --- moving -----------------------------------------------------------------------------------

    async def _locked(self, order_id: uuid.UUID, *scope: ColumnElement[bool]) -> Order:
        order = await self.shop.locked_order(order_id, *scope)
        if order is None:
            raise NotFoundError("Order not found")
        return order

    def _event(self, order: Order, status: OrderStatus, at: datetime) -> None:
        order.status = status
        order.events.append(OrderEvent(status=status, at=at))

    async def _give_back_stock(self, order: Order) -> None:
        products = await self.shop.products_by_id([i.product_id for i in order.items if i.product_id])
        for item in order.items:
            if item.product_id in products:
                products[item.product_id].stock += item.quantity

    async def _cancel(self, order: Order, by: str, reason: str | None) -> None:
        if order.status not in OPEN_ORDER:
            raise ConflictError("Only orders that haven't shipped can be cancelled")
        self._event(order, OrderStatus.cancelled, self.clock.now())
        order.cancelled_by = by
        order.cancel_reason = reason or None
        await self._give_back_stock(order)

    async def _advance(self, order: Order, to: OrderStatus, tracking: str | None = None) -> None:
        if NEXT.get(order.status) != to:
            raise ConflictError(f"A {order.status.value} order can't be marked {to.value}")
        if to == OrderStatus.shipped:
            if order.payment_method == "pay_before_shipping" and order.paid_at is None:
                raise ConflictError("Mark the order paid before shipping it")
            order.tracking = tracking or None
        self._event(order, to, self.clock.now())

    # --- customer ---------------------------------------------------------------------------------

    async def mine(self, customer: User, limit: int, cursor: str | None):
        return await self._page([Order.customer_id == customer.id], limit, cursor)

    async def my_order(self, customer: User, order_id: uuid.UUID) -> dict[str, Any]:
        return await self._out(order_id, Order.customer_id == customer.id)

    async def customer_cancel(self, customer: User, order_id: uuid.UUID, reason: str | None) -> dict[str, Any]:
        mine = Order.customer_id == customer.id
        await self._cancel(await self._locked(order_id, mine), "customer", reason)
        await self.session.flush()
        return await self._out(order_id, mine)

    # --- artist -----------------------------------------------------------------------------------

    async def _theirs(self, user: User) -> ColumnElement[bool]:
        return Order.artist_id == await approved_artist_id(self.session, user)

    async def artist_orders(self, user: User, view: ArtistOrderView, limit: int, cursor: str | None):
        return await self._page([await self._theirs(user), *view_filter(view)], limit, cursor)

    async def artist_step(
        self, user: User, order_id: uuid.UUID, action: str, value: str | None = None
    ) -> dict[str, Any]:
        theirs = await self._theirs(user)
        order = await self._locked(order_id, theirs)
        if action == "confirm":
            await self._advance(order, OrderStatus.confirmed)
        elif action == "ship":
            await self._advance(order, OrderStatus.shipped, value)
        elif action == "deliver":
            await self._advance(order, OrderStatus.delivered)
        elif action == "paid":
            if order.payment_method != "pay_before_shipping" or order.status == OrderStatus.cancelled:
                raise ConflictError("Only open pay-before-shipping orders are marked paid here")
            order.paid_at = order.paid_at or self.clock.now()
        else:
            await self._cancel(order, "artist", value)
        await self.session.flush()
        return await self._out(order_id, theirs)

    async def artist_summary(self, user: User, products: int) -> dict[str, Any]:
        artist_id = await approved_artist_id(self.session, user)
        now = self.clock.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        counts = await self.shop.order_counts(Order.artist_id == artist_id)
        orders, sales = await self.shop.month_sales(artist_id, month_start)
        return {
            "to_pack": counts["to_pack"],
            "orders_this_month": orders,
            "sales_this_month_paise": sales,
            "products": products,
        }

    # --- admin ------------------------------------------------------------------------------------

    async def admin_list(self, view: AdminOrderView, limit: int, cursor: str | None):
        return await self._page(view_filter(view), limit, cursor)

    async def admin_summary(self) -> dict[str, Any]:
        return {"counts": await self.shop.order_counts()}

    async def admin_set_status(self, order_id: uuid.UUID, status: OrderStatus, reason: str | None) -> dict[str, Any]:
        order = await self._locked(order_id)
        if status == OrderStatus.cancelled:
            await self._cancel(order, "admin", reason)
        else:
            await self._advance(order, status)
        await self.session.flush()
        return await self._out(order_id)
