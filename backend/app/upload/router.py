from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.core.exceptions import ForbiddenError
from app.shared.enums import UserRole
from app.shared.responses import errors
from app.upload.dependencies import limit_signatures
from app.upload.schemas import UploadOut, UploadRequest
from app.upload.service import ImageStorage, get_storage
from app.user.models import User

router = APIRouter(prefix="/uploads", tags=["uploads"], responses=errors(401, 403, 422, 429))


@router.post(
    "/signature",
    response_model=UploadOut,
    status_code=200,
    summary="Signed form for a direct image upload",
    dependencies=[Depends(limit_signatures)],
)
async def upload_signature(
    body: UploadRequest,
    user: User = Depends(get_current_user),
    storage: ImageStorage = Depends(get_storage),
) -> dict:
    """Artists sign every purpose; customers only chat photos."""
    if body.purpose != "chat" and UserRole.artist not in user.roles:
        raise ForbiddenError()
    return storage.upload_params(user.id, body.purpose)
