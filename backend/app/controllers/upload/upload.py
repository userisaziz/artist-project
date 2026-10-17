from app.models.user.user import User
from app.schemas.upload.upload import UploadOut, UploadRequest
from app.services.upload.storage import ImageStorage


def upload_signature(body: UploadRequest, user: User, storage: ImageStorage) -> UploadOut:
    return UploadOut(**storage.upload_params(user.id, body.purpose))
