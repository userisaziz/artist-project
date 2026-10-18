"""The httpOnly refresh-token cookie: how it is set and cleared (see constants.SessionTransport)."""

from dataclasses import dataclass

from starlette.responses import Response

from app.auth.constants import REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH, SessionTransport

SECONDS_PER_DAY = 86_400


@dataclass(frozen=True)
class RefreshCookie:
    transport: SessionTransport
    secure: bool
    lifetime_seconds: int

    def set(self, response: Response, refresh_token: str) -> None:
        persistent = self.transport is SessionTransport.COOKIE
        response.set_cookie(
            REFRESH_COOKIE_NAME,
            refresh_token,
            max_age=self.lifetime_seconds if persistent else None,
            path=REFRESH_COOKIE_PATH,
            secure=self.secure,
            httponly=True,
            samesite="strict",
        )

    def clear(self, response: Response) -> None:
        response.delete_cookie(
            REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH, secure=self.secure, httponly=True, samesite="strict"
        )

    def clearing_headers(self) -> dict[str, str]:
        """The clearing Set-Cookie as plain headers, for error responses built by the exception handlers."""
        response = Response()
        self.clear(response)
        return {"set-cookie": response.headers["set-cookie"]}
