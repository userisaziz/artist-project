from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    """Base for every request/response schema in the app."""


class ORMModel(APIModel):
    """Base for response schemas built straight off ORM rows (`model_validate(row)`)."""

    model_config = ConfigDict(from_attributes=True)


class ErrorResponse(APIModel):
    code: str
    message: str
