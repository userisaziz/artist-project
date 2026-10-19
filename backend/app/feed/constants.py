"""Post kinds and topics, content limits and request allowances (fixed windows, see app.core.rate_limit)."""

import enum
from typing import Literal

from app.core.rate_limit import Limit

MAX_PHOTOS = 10
TITLE_MAX = 140
TITLE_MIN = 3
TEXT_MAX = 20000  # an article body; captions stop at CAPTION_MAX
CAPTION_MAX = 2200
EXCERPT_MAX = 200
WORDS_PER_MINUTE = 200

POSTS_PER_USER = Limit(hits=30, window_seconds=86400)
REACTIONS_PER_USER = Limit(hits=600, window_seconds=3600)

FeedTab = Literal["for_you", "following", "stories"]


class PostKind(str, enum.Enum):
    photos = "photos"
    article = "article"


class PostTopic(str, enum.Enum):
    """look: a photo set of finished work; guide: how-to; story: behind the scenes, a client's day."""

    look = "look"
    guide = "guide"
    story = "story"
