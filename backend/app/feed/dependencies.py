from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import Limit, limit_by_user
from app.feed import constants
from app.feed.service import FeedService
from app.shared.clock import Clock, get_clock
from app.upload.service import ImageStorage, get_storage


def get_feed_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    storage: ImageStorage = Depends(get_storage),
    clock: Clock = Depends(get_clock),
) -> FeedService:
    return FeedService(session, storage, clock)


def featured_slots() -> int:
    return constants.FEATURED_SLOTS


def posts_per_user() -> Limit:
    return constants.POSTS_PER_USER


def reactions_per_user() -> Limit:
    return constants.REACTIONS_PER_USER


limit_posts = limit_by_user("feed_post", posts_per_user)
limit_reactions = limit_by_user("feed_reaction", reactions_per_user)
