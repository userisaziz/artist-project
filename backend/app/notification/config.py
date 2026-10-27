from functools import lru_cache
from typing import Literal, Self

from pydantic import model_validator

from app.core.config import AppSettings


class NotificationSettings(AppSettings):
    # console: log and record pushes (dev, tests; never in production). expo: send through Expo's push service;
    # needs the app's EAS project so devices can register Expo push tokens.
    push_provider: Literal["console", "expo"] = "console"
    expo_push_url: str = "https://exp.host/--/api/v2/push/send"
    push_timeout_seconds: float = 5.0

    @model_validator(mode="after")
    def _real_push_in_production(self) -> Self:
        if self.push_provider == "console" and self.is_production:
            raise ValueError("PUSH_PROVIDER=console only logs pushes; it cannot run with ENVIRONMENT=production")
        return self


@lru_cache
def get_notification_settings() -> NotificationSettings:
    return NotificationSettings()
