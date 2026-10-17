from fastapi import APIRouter, Depends

from app.core.auth import current_artist
from app.models.user import User
from app.schemas.artist import UploadOut, UploadRequest
from app.services.storage import ImageStorage, get_storage

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/signature", response_model=UploadOut)
async def upload_signature(
    body: UploadRequest,
    user: User = Depends(current_artist),
    storage: ImageStorage = Depends(get_storage),
) -> UploadOut:
    return UploadOut(**storage.upload_params(user.id, body.purpose))
