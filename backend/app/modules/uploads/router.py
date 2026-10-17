from fastapi import APIRouter, Depends

from app.core.auth import current_artist
from app.modules.uploads.schemas import UploadOut, UploadRequest
from app.modules.uploads.storage import ImageStorage, get_storage
from app.modules.users.models import User

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/signature", response_model=UploadOut)
async def upload_signature(
    body: UploadRequest,
    user: User = Depends(current_artist),
    storage: ImageStorage = Depends(get_storage),
) -> UploadOut:
    return UploadOut(**storage.upload_params(user.id, body.purpose))
