from fastapi import APIRouter, Depends

from app.core.auth import current_artist
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
    user: User = Depends(current_artist),
    storage: ImageStorage = Depends(get_storage),
) -> dict:
    return storage.upload_params(user.id, body.purpose)
