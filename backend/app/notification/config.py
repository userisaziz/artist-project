from functools import lru_cache
from typing import Literal

from app.core.config import AppSettings


class NotificationSettings(AppSettings):
    # console: log and record pushes (dev, tests). expo: send through Expo's push service; needs the app's EAS
    # project so devices can register Expo push tokens.
    push_provider: Literal["console", "expo"] = "console"
    expo_push_url: str = "https://exp.host/--/api/v2/push/send"
    push_timeout_seconds: float = 5.0


@lru_cache
def get_notification_settings() -> NotificationSettings:
    return NotificationSettings()
