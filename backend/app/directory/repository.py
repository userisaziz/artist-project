"""Queries behind the public directory: approved artists, their categories, completed-booking counts."""

import uuid
from collections.abc import Iterable, Sequence
from dataclasses import replace
from datetime import date, datetime
from typing import Any, NamedTuple

from sqlalchemy import ColumnElement, Row, Select, and_, case, func, null, or_, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defaultload, raiseload

from app.artist.models import ArtistDayOff, ArtistProfile, ArtistServiceItem, ArtistWorkingHour, artist_categories
from app.booking import rules as booking_rules
from app.booking.models import Booking
from app.booking.repository import holds_slot, reschedule_pending
from app.catalog.models import Area, Category, ServiceTemplate
from app.chat.constants import ChatSide, MessageModeration
from app.chat.models import Conversation, Message
from app.directory.constants import (
    RECOMMENDED_PRIOR_RATING,
    RECOMMENDED_PRIOR_REVIEWS,
    DirectorySort,
)
from app.directory.utils import SearchFilters
from app.requirement.utils import publicly_visible
from app.review.models import PUBLIC_REVIEW, Review
from app.shared.enums import ArtistServiceStatus, BookingStatus
from app.shared.geo import distance_km
from app.shared.pagination import keyset
from app.shared.search import like_pattern

# Approval time; created_at stands in if an approved row somehow lacks it, so paging never meets a NULL.
LISTED_AT = func.coalesce(ArtistProfile.reviewed_at, ArtistProfile.created_at)

# Where an artist is on the map: their own pin, else the centre of the area they picked (NULL with neither).
_PINNED = and_(ArtistProfile.latitude.is_not(None), ArtistProfile.longitude.is_not(None))
ARTIST_LAT = case((_PINNED, ArtistProfile.latitude), else_=Area.latitude)
ARTIST_LNG = case((_PINNED, ArtistProfile.longitude), else_=Area.longitude)


class SearchColumns(NamedTuple):
    """Per-artist values the search filters and sorts on (NULL when the artist has none)."""

    rating: ColumnElement  # one-decimal average of public reviews, as the cards show it
    stars: ColumnElement  # sum of public review ratings
    reviews: ColumnElement  # number of public reviews
    from_price: ColumnElement  # cheapest approved service, paise
    distance: ColumnElement  # km from the search point


class DetailRow(NamedTuple):
    """One artist's profile plus every stat the detail page shows, as plain values. The calendar fields
    (hours/days_off/busy) are JSON the service reads with pure slot math, so the next-free search never
    touches the database."""

    profile: ArtistProfile
    rating: Any  # one-decimal average of public reviews, NULL when there are none
    review_count: int
    completed: int
    per_service: Any  # service id → completed bookings
    category_refs: Any  # category id → {name, parent_id}, for the services' categories and their parents
    hours: Any  # the saved weekly hour rows
    days_off: Any  # ISO days within the search window
    busy: Any  # [start, end] ISO pairs held within the window
    reply: Any  # [median minutes, reply count]


class DirectoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _search(self, filters: SearchFilters, *, load_services: bool = False) -> tuple[Select, SearchColumns]:
        """Approved artists matching `filters` as (profile, listed-at, distance km or NULL, cheapest service,
        rating, review count) rows, unordered, plus the columns the sorts need. KYC is never loaded.

        The services are left out unless asked for: the card's price comes from the `prices` subquery, and loading
        the services would drag their templates and addons along for three more round trips."""
        ratings = (
            select(
                Review.artist_id,
                func.avg(Review.rating).label("avg"),
                func.sum(Review.rating).label("stars"),
                func.count().label("n"),
            )
            .where(Review.status.in_(PUBLIC_REVIEW))
            .group_by(Review.artist_id)
            .subquery()
        )
        prices = (
            select(ArtistServiceItem.artist_id, func.min(ArtistServiceItem.price_paise).label("from_price"))
            .where(ArtistServiceItem.status == ArtistServiceStatus.approved)
            .group_by(ArtistServiceItem.artist_id)
            .subquery()
        )
        distance = distance_km(ARTIST_LAT, ARTIST_LNG, *filters.near) if filters.near else null()
        rating = func.round(ratings.c.avg, 1)
        reviews = func.coalesce(ratings.c.n, 0)
        options = [raiseload(ArtistProfile.kyc)]
        if not load_services:
            options.append(raiseload(ArtistProfile.services))
        query = (
            select(ArtistProfile, LISTED_AT, distance, prices.c.from_price, rating, reviews)
            .outerjoin(ratings, ratings.c.artist_id == ArtistProfile.id)
            .outerjoin(prices, prices.c.artist_id == ArtistProfile.id)
            .where(publicly_visible())
            .options(*options)
        )
        if filters.near:
            # A point replaces the city: "near me" crosses city lines.
            query = query.outerjoin(Area, Area.id == ArtistProfile.area_id)
            if filters.radius_km is not None:
                query = query.where(distance <= filters.radius_km)
        elif filters.city:
            query = query.where(ArtistProfile.city == filters.city)
        if filters.category_id is not None:
            query = query.where(
                ArtistProfile.id.in_(
                    select(artist_categories.c.artist_id).where(artist_categories.c.category_id == filters.category_id)
                )
            )
        if filters.q and filters.q.strip():
            pattern = like_pattern(filters.q)
            offers_it = (
                select(ArtistServiceItem.artist_id)
                .outerjoin(ServiceTemplate, ServiceTemplate.id == ArtistServiceItem.template_id)
                .where(
                    ArtistServiceItem.status == ArtistServiceStatus.approved,
                    or_(
                        ArtistServiceItem.name.ilike(pattern, escape="\\"),
                        ServiceTemplate.name.ilike(pattern, escape="\\"),
                    ),
                )
            )
            query = query.where(
                or_(ArtistProfile.business_name.ilike(pattern, escape="\\"), ArtistProfile.id.in_(offers_it))
            )
        columns = SearchColumns(rating, ratings.c.stars, reviews, prices.c.from_price, distance)
        if filters.min_rating is not None:
            query = query.where(columns.rating >= filters.min_rating)
        if filters.max_price_paise is not None:
            query = query.where(columns.from_price <= filters.max_price_paise)
        if filters.home_visit:
            query = query.where(ArtistProfile.travel_radius_km.is_not(None))
        return query, columns

    def _matched(self, filters: SearchFilters) -> ColumnElement:
        """How many artists match `filters`, as a column a page query can carry: the count rides the page's own
        round trip (Postgres runs the uncorrelated subquery once), so the client never pays a statement for it."""
        query, _ = self._search(filters)
        return select(func.count()).select_from(query.subquery()).scalar_subquery()

    async def approved_page(self, filters: SearchFilters, limit: int, cursor: str | None) -> list[Row]:
        """Most recently approved first, keyset-paged; `limit + 1` rows so the caller can tell if there's more."""
        query, _ = self._search(filters)
        query = keyset(query, LISTED_AT, ArtistProfile.id, descending=True, cursor=cursor).limit(limit + 1)
        query = query.add_columns(self._matched(filters))
        return list((await self.session.execute(query)).all())

    async def sorted_page(
        self, filters: SearchFilters, offset: int, limit: int, *, load_services: bool = False
    ) -> list[Row]:
        """`limit` rows from `offset` in `filters.sort` order; ties fall back to most recently approved."""
        query, c = self._search(filters, load_services=load_services)
        order = {
            DirectorySort.recommended: [_recommended_score(c).desc()],
            DirectorySort.rating: [c.rating.desc().nulls_last(), c.reviews.desc()],
            DirectorySort.price: [c.from_price.asc().nulls_last()],
            DirectorySort.nearest: [c.distance.asc().nulls_last()],
        }.get(filters.sort, [])
        query = query.order_by(*order, LISTED_AT.desc(), ArtistProfile.id.desc()).offset(offset).limit(limit)
        query = query.add_columns(self._matched(filters))
        return list((await self.session.execute(query)).all())

    async def count(self, filters: SearchFilters) -> int:
        query, _ = self._search(filters)
        return (await self.session.execute(select(func.count()).select_from(query.subquery()))).scalar_one()

    async def count_within(self, filters: SearchFilters, radii_km: Sequence[float]) -> list[int]:
        """How many artists match `filters` within each of `radii_km` of `filters.near`, in one query."""
        query, c = self._search(replace(filters, radius_km=None))
        found = query.add_columns(c.distance.label("distance_km")).subquery()
        counts = [func.count().filter(found.c.distance_km <= radius) for radius in radii_km]
        return list((await self.session.execute(select(*counts))).one())

    async def approved(self, artist_id: uuid.UUID) -> ArtistProfile | None:
        return (
            await self.session.execute(
                select(ArtistProfile)
                .where(ArtistProfile.id == artist_id, publicly_visible())
                .options(raiseload(ArtistProfile.kyc))
            )
        ).scalar_one_or_none()

    async def approved_many(self, artist_ids: list[uuid.UUID]) -> list[ArtistProfile]:
        query = (
            select(ArtistProfile)
            .where(ArtistProfile.id.in_(artist_ids), publicly_visible())
            .options(raiseload(ArtistProfile.kyc))
        )
        return list((await self.session.scalars(query)).all())

    def _detail_columns(self, artist_id: uuid.UUID, today: date, until: date, now: datetime) -> list[ColumnElement]:
        """Every detail-page stat as one column each, all keyed off the bound artist_id — no correlation, and
        Postgres runs them as a single InitPlan pass of the profile's own round trip."""
        rating = (
            select(func.round(func.avg(Review.rating), 1))
            .where(Review.artist_id == artist_id, Review.status.in_(PUBLIC_REVIEW))
            .scalar_subquery()
        )
        review_count = (
            select(func.count())
            .where(Review.artist_id == artist_id, Review.status.in_(PUBLIC_REVIEW))
            .scalar_subquery()
        )
        completed = (
            select(func.count())
            .select_from(Booking)
            .where(Booking.artist_id == artist_id, Booking.status == BookingStatus.completed)
            .scalar_subquery()
        )
        finished = (
            select(Booking.service_id.label("service_id"), func.count().label("n"))
            .where(
                Booking.artist_id == artist_id,
                Booking.status == BookingStatus.completed,
                Booking.service_id.is_not(None),
            )
            .group_by(Booking.service_id)
            .subquery()
        )
        per_service = select(func.json_object_agg(finished.c.service_id, finished.c.n)).scalar_subquery()
        offers = select(ArtistServiceItem.category_id).where(
            ArtistServiceItem.artist_id == artist_id, ArtistServiceItem.status == ArtistServiceStatus.approved
        )
        category_refs = (
            select(
                func.json_object_agg(
                    Category.id, func.json_build_object("name", Category.name, "parent_id", Category.parent_id)
                )
            )
            .where(
                or_(Category.id.in_(offers), Category.id.in_(select(Category.parent_id).where(Category.id.in_(offers))))
            )
            .scalar_subquery()
        )
        hours = (
            select(
                func.json_agg(
                    func.json_build_object(
                        "weekday",
                        ArtistWorkingHour.weekday,
                        "is_open",
                        ArtistWorkingHour.is_open,
                        "open_hour",
                        ArtistWorkingHour.open_hour,
                        "close_hour",
                        ArtistWorkingHour.close_hour,
                    )
                )
            )
            .where(ArtistWorkingHour.artist_id == artist_id)
            .scalar_subquery()
        )
        days_off = (
            select(func.json_agg(ArtistDayOff.day_date))
            .where(ArtistDayOff.artist_id == artist_id, ArtistDayOff.day_date >= today, ArtistDayOff.day_date <= until)
            .scalar_subquery()
        )
        window_start, window_end = booking_rules.ist_day_bounds(today, until)
        held = union_all(
            select(Booking.start_at, Booking.end_at).where(
                Booking.artist_id == artist_id,
                Booking.start_at < window_end,
                Booking.end_at > window_start,
                holds_slot(now),
            ),
            select(Booking.reschedule_start_at, Booking.reschedule_end_at).where(
                Booking.artist_id == artist_id,
                Booking.reschedule_start_at < window_end,
                Booking.reschedule_end_at > window_start,
                reschedule_pending(now),
            ),
        ).subquery()
        busy = select(func.json_agg(func.json_build_array(held.c.start_at, held.c.end_at))).scalar_subquery()
        delivered = or_(Message.moderation.is_(None), Message.moderation == MessageModeration.allowed)
        timeline = (
            select(
                Message.sender,
                Message.created_at,
                func.lag(Message.sender)
                .over(partition_by=Message.conversation_id, order_by=(Message.created_at, Message.id))
                .label("previous_sender"),
                func.lag(Message.created_at)
                .over(partition_by=Message.conversation_id, order_by=(Message.created_at, Message.id))
                .label("previous_at"),
            )
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(Conversation.artist_id == artist_id, delivered)
            .subquery()
        )
        gap = func.extract("epoch", timeline.c.created_at - timeline.c.previous_at) / 60
        replies = (
            select(
                func.percentile_cont(0.5).within_group(gap).label("median"),
                func.count().label("n"),
            )
            .where(timeline.c.sender == ChatSide.artist, timeline.c.previous_sender == ChatSide.customer)
            .subquery()
        )
        reply = select(func.json_build_array(replies.c.median, replies.c.n)).scalar_subquery()
        return [rating, review_count, completed, per_service, category_refs, hours, days_off, busy, reply]

    async def detail_row(self, artist_id: uuid.UUID, *, today: date, until: date, now: datetime) -> DetailRow | None:
        """The approved artist behind `artist_id` and every stat of their detail page, in one round trip;
        None (404) for drafts, pending and rejected profiles."""
        row = (
            await self.session.execute(
                select(ArtistProfile, *self._detail_columns(artist_id, today, until, now))
                .where(ArtistProfile.id == artist_id, publicly_visible())
                .options(
                    raiseload(ArtistProfile.kyc),
                    defaultload(ArtistProfile.services).raiseload(ArtistServiceItem.subcategory_request),
                )
            )
        ).one_or_none()
        return DetailRow(*row) if row else None

    async def categories(self, ids: Iterable[int]) -> dict[int, Category]:
        rows = (await self.session.execute(select(Category).where(Category.id.in_(set(ids))))).scalars()
        return {c.id: c for c in rows}

    async def completed_bookings(self, artist_id: uuid.UUID) -> int:
        return (
            await self.session.execute(
                select(func.count())
                .select_from(Booking)
                .where(Booking.artist_id == artist_id, Booking.status == BookingStatus.completed)
            )
        ).scalar_one()

    async def completed_by_service(self, artist_id: uuid.UUID) -> dict[uuid.UUID, int]:
        """service id → completed bookings; services nobody has finished a booking for are absent."""
        rows = await self.session.execute(
            select(Booking.service_id, func.count())
            .where(
                Booking.artist_id == artist_id,
                Booking.status == BookingStatus.completed,
                Booking.service_id.is_not(None),
            )
            .group_by(Booking.service_id)
        )
        # The WHERE already drops booking rows without a service; the check only tells the type checker that.
        return {service_id: count for service_id, count in rows.all() if service_id is not None}


def _recommended_score(c: SearchColumns) -> ColumnElement:
    """Bayesian average: the artist's stars plus a prior of RECOMMENDED_PRIOR_REVIEWS reviews at the prior rating."""
    prior = RECOMMENDED_PRIOR_RATING * RECOMMENDED_PRIOR_REVIEWS
    return (func.coalesce(c.stars, 0) + prior) / (func.coalesce(c.reviews, 0) + RECOMMENDED_PRIOR_REVIEWS)
