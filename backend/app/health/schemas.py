from typing import Literal

from app.shared.schemas import APIModel


class LiveOut(APIModel):
    status: Literal["ok"] = "ok"


class ReadyOut(APIModel):
    status: Literal["ok"] = "ok"
    db: Literal["ok"] = "ok"
