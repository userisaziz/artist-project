from app.booking import constants
from app.core.rate_limit import Limit, limit_by_user


def booking_requests_per_user() -> Limit:
    return constants.BOOKING_REQUESTS_PER_USER


def reviews_per_user() -> Limit:
    return constants.REVIEWS_PER_USER


limit_booking_requests = limit_by_user("booking_request", booking_requests_per_user)
limit_reviews = limit_by_user("review", reviews_per_user)
