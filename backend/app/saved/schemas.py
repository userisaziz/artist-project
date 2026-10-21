import uuid

from app.shared.schemas import APIModel


class SavedIds(APIModel):
    """Every saved id of each kind, visible or not, so the app can fill its bookmark icons."""

    posts: list[uuid.UUID]
    artists: list[uuid.UUID]
    products: list[uuid.UUID]
