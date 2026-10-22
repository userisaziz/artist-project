from typing import Literal

DirectoryStatus = Literal["all", "approved", "pending", "suspended", "on_hold"]  # on hold: an overdue requirement

WINDOW_DAYS = 30  # booking value, response time and at-risk look back this far
AT_RISK_RATE = 0.08  # declined or artist-cancelled share of the window's bookings above which an artist is at risk
