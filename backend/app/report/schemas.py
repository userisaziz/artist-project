from app.shared.schemas import APIModel


class Leader(APIModel):
    name: str
    share: float  # of the period's bookings


class ReportSummary(APIModel):
    period_days: int | None  # None for all time
    bookings: int
    bookings_previous: int | None  # the period before, for a trend; None for all time
    completed: int
    completion_rate: float | None
    top_city: Leader | None
    top_category: Leader | None
