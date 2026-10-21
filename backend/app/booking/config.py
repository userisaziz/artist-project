"""Booking rules and money. Values are copied onto each booking, so changes only affect new ones."""

from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, model_validator

from app.core.config import AppSettings

# direct: the customer pays the artist's UPI themselves; the platform records the amounts but holds no money.
# mock: dev/test only, marks the deposit paid with no gateway. Razorpay arrives in phase 2.
PaymentProvider = Literal["direct", "mock"]


class BookingSettings(AppSettings):
    platform_fee_paise: int = Field(9_900, ge=0)  # ₹99 charged to the customer…
    platform_fee_waived_from_paise: int = Field(2_500_000, ge=0)  # …unless the service costs ₹25,000 or more
    deposit_percent: int = Field(30, ge=0, le=100)  # of the total, paid when requesting
    commission_percent: int = Field(10, ge=0, le=100)  # of the service price, kept from the artist
    booking_accept_hours: int = Field(3, ge=1)  # the artist's window to accept a request
    free_cancel_hours: int = Field(72, ge=0)  # customer cancellations this far ahead get the deposit back
    booking_lead_hours: int = Field(2, ge=0)  # earliest bookable start, from now
    booking_horizon_days: int = Field(60, ge=1)
    max_open_requests_per_customer: int = Field(3, ge=1)  # unanswered requests at once, so no one squats on slots
    payment_provider: PaymentProvider = "direct"

    @model_validator(mode="after")
    def _no_mock_payments_in_production(self) -> Self:
        if self.payment_provider == "mock" and self.is_production:
            raise ValueError("PAYMENT_PROVIDER=mock takes no real money; it cannot run with ENVIRONMENT=production")
        return self


@lru_cache
def get_booking_settings() -> BookingSettings:
    return BookingSettings()
