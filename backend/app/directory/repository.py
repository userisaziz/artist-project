"""Queries behind the public directory: approved artists, their categories, completed-booking counts."""

import uuid
from collections.abc import Iterable
from typing import NamedTuple

from sqlalchemy import ColumnElement, Row, Select, func, null, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import raiseload

from app.artist.models import ArtistProfile, ArtistServiceItem, artist_categories
from app.booking.models import Booking
from app.catalog.models import Category, ServiceTemplate
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


class SearchColumns(NamedTuple):
    """Per-artist values the search filters and sorts on (NULL when the artist has none)."""

    rating: ColumnElement  # one-decimal average of public reviews, as the cards show it
    stars: ColumnElement  # sum of public review ratings
    reviews: ColumnElement  # number of public reviews
    from_price: ColumnElement  # cheapest approved service, paise
    distance: ColumnElement  # km from the search point


class DirectoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _search(self, filters: SearchFilters) -> tuple[Select, SearchColumns]:
        """Approved artists matching `filters` as (profile, listed-at, distance km or NULL) rows, unordered,
        plus the columns the sorts need. KYC is never loaded."""
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
        distance = (
            distance_km(ArtistProfile.latitude, ArtistProfile.longitude, *filters.near) if filters.near else null()
        )
        query = (
            select(ArtistProfile, LISTED_AT, distance)
            .outerjoin(ratings, ratings.c.artist_id == ArtistProfile.id)
            .outerjoin(prices, prices.c.artist_id == ArtistProfile.id)
            .where(publicly_visible())
            .options(raiseload(ArtistProfile.kyc))
        )
        if filters.city:
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
        columns = SearchColumns(
            func.round(ratings.c.avg, 1), ratings.c.stars, ratings.c.n, prices.c.from_price, distance
        )
        if filters.min_rating is not None:
            query = query.where(columns.rating >= filters.min_rating)
        if filters.max_price_paise is not None:
            query = query.where(columns.from_price <= filters.max_price_paise)
        if filters.home_visit:
            query = query.where(ArtistProfile.travel_radius_km.is_not(None))
        return query, columns

    async def approved_page(self, filters: SearchFilters, limit: int, cursor: str | None) -> list[Row]:
        """Most recently approved first, keyset-paged; `limit + 1` rows so the caller can tell if there's more."""
        query, _ = self._search(filters)
        query = keyset(query, LISTED_AT, ArtistProfile.id, descending=True, cursor=cursor).limit(limit + 1)
        return list((await self.session.execute(query)).all())

    async def sorted_page(self, filters: SearchFilters, offset: int, limit: int) -> list[Row]:
        """`limit` rows from `offset` in `filters.sort` order; ties fall back to most recently approved."""
        query, c = self._search(filters)
        order = {
            DirectorySort.recommended: [_recommended_score(c).desc()],
            DirectorySort.rating: [c.rating.desc().nulls_last(), func.coalesce(c.reviews, 0).desc()],
            DirectorySort.price: [c.from_price.asc().nulls_last()],
            DirectorySort.nearest: [c.distance.asc().nulls_last()],
        }.get(filters.sort, [])
        query = query.order_by(*order, LISTED_AT.desc(), ArtistProfile.id.desc()).offset(offset).limit(limit)
        return list((await self.session.execute(query)).all())

    async def count(self, filters: SearchFilters) -> int:
        query, _ = self._search(filters)
        return (await self.session.execute(select(func.count()).select_from(query.subquery()))).scalar_one()

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
        return {service_id: count for service_id, count in rows.all()}


def _recommended_score(c: SearchColumns) -> ColumnElement:
    """Bayesian average: the artist's stars plus a prior of RECOMMENDED_PRIOR_REVIEWS reviews at the prior rating."""
    prior = RECOMMENDED_PRIOR_RATING * RECOMMENDED_PRIOR_REVIEWS
    return (func.coalesce(c.stars, 0) + prior) / (func.coalesce(c.reviews, 0) + RECOMMENDED_PRIOR_REVIEWS)
