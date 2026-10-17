from app.core.rate_limit import Limit, limit_by_user
from app.upload import constants


def signatures_per_user() -> Limit:
    return constants.SIGNATURES_PER_USER


limit_signatures = limit_by_user("upload_signature", signatures_per_user)
