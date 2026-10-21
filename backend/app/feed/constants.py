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
SEARCH_MAX = 60  # GET /feed?q=
WORDS_PER_MINUTE = 200

POSTS_PER_USER = Limit(hits=30, window_seconds=86400)
REACTIONS_PER_USER = Limit(hits=600, window_seconds=3600)

FeedTab = Literal["for_you", "following", "stories"]
AdminFeedView = Literal["all", "featured", "reported", "hidden"]
ReportReason = Literal["spam", "inappropriate", "contact_details", "other"]
ModerationDecision = Literal["keep", "hide", "remove"]

FEATURED_SLOTS = 12  # featured posts lead For you, at most this many at once
MODERATION_NOTE_MAX = 500
RECENT_DAYS = 7


class PostKind(str, enum.Enum):
    photos = "photos"
    article = "article"


class Moderation(str, enum.Enum):
    """live: in the feed. hidden: taken down by a moderator (the artist still sees it). removed: final."""

    live = "live"
    hidden = "hidden"
    removed = "removed"


class PostTopic(str, enum.Enum):
    """look: a photo set of finished work; guide: how-to; story: behind the scenes, a client's day."""

    look = "look"
    guide = "guide"
    story = "story"
