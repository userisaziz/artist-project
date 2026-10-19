"""Feed contracts. Cards and the full post share one shape: `body` is only filled on the full article."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import Field, StringConstraints

from app.feed.constants import MAX_PHOTOS, TEXT_MAX, TITLE_MAX, PostKind, PostTopic
from app.shared.schemas import APIModel

MAX_SIDE = 10000


class PhotoIn(APIModel):
    key: Annotated[str, StringConstraints(min_length=1, max_length=255)]
    width: int = Field(ge=1, le=MAX_SIDE)
    height: int = Field(ge=1, le=MAX_SIDE)


class PostIn(APIModel):
    """Photo sets need 1–10 photos; articles need a title. Checked in the service (domain rules)."""

    kind: PostKind
    topic: PostTopic | None = None  # photo sets default to `look`, articles to `guide`
    title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=TITLE_MAX)] | None = None
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=TEXT_MAX)]
    photos: list[PhotoIn] = Field(default_factory=list, max_length=MAX_PHOTOS)
    cover: PhotoIn | None = None
    service_id: uuid.UUID | None = None


class PostPhotoOut(APIModel):
    url: str
    width: int
    height: int


class PostArtist(APIModel):
    id: uuid.UUID
    business_name: str
    photo_url: str | None
    city: str
    rating_average: float | None
    rating_count: int


class PostService(APIModel):
    id: uuid.UUID
    name: str
    price_paise: int


class PostOut(APIModel):
    id: uuid.UUID
    kind: PostKind
    topic: PostTopic
    title: str | None
    text: str | None  # a photo set's caption
    excerpt: str | None  # an article's opening paragraph
    body: str | None  # the full article (post detail and the artist's own posts only)
    read_minutes: int | None
    cover_url: str | None
    photos: list[PostPhotoOut]
    artist: PostArtist
    service: PostService | None
    like_count: int
    liked: bool
    following: bool
    created_at: datetime


class PostPage(APIModel):
    items: list[PostOut]
    next_cursor: str | None


class LikeOut(APIModel):
    liked: bool
    like_count: int


class FollowOut(APIModel):
    following: bool
