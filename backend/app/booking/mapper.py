"""How a booking is shown to its customer, its artist, or an admin."""

from datetime import datetime
from typing import Any, Literal

from app.booking.repository import BookingRow
from app.booking.utils import reschedule_pending
from app.review.filters import review_window_open
from app.review.models import PUBLIC_REVIEW
from app.shared.enums import BookingStatus
from app.upload.service import ImageStorage

View = Literal["customer", "artist", "admin"]  # who a booking is shown to


def booking_out(row: BookingRow, storage: ImageStorage, view: View, now: datetime) -> dict[str, Any]:
    """Customers never see the platform's margin or the artist's payout; only admins see the customer's phone.
    Shape is a plain dict; the route's response_model validates and serialises it."""
    b = row.booking
    admin = view == "admin"
    margin_hidden = view == "customer"
    # The artist sees a review only once it's public; the reviewer and admins see it in any state.
    show_review = row.review_id is not None and (view != "artist" or row.review_status in PUBLIC_REVIEW)
    customer = {
        "id": b.customer_id,
        "first_name": row.first_name,
        "last_name": row.last_name,
        **({"phone": row.phone} if admin else {}),
    }
    return {
        "id": b.id,
        "code": b.code,
        "status": b.status,
        "start_at": b.start_at,
        "end_at": b.end_at,
        "address": b.address,
        "note": b.note,
        "service_id": b.service_id,
        "service_name": b.service_name,
        "duration_minutes": b.duration_minutes,
        "artist": {
            "id": b.artist_id,
            "business_name": row.business_name,
            "city": row.city,
            "photo_url": storage.url(row.photo_key, "thumb") if row.photo_key else None,
        },
        "customer": customer,
        "subtotal_paise": b.subtotal_paise,
        "platform_fee_paise": b.platform_fee_paise,
        "total_paise": b.total_paise,
        "deposit_paise": b.deposit_paise,
        "balance_paise": b.balance_paise,
        "commission_paise": None if margin_hidden else b.commission_paise,
        "artist_earning_paise": None if margin_hidden else b.artist_earning_paise,
        "addons": [
            {
                "name": a.name,
                "unit_price_paise": a.unit_price_paise,
                "per_person": a.per_person,
                "guests": a.guests,
                "line_paise": a.line_paise,
            }
            for a in b.addons
        ],
        "deposit_paid_at": b.deposit_paid_at,
        "expires_at": b.expires_at,
        "responded_at": b.responded_at,
        "cancelled_at": b.cancelled_at,
        "completed_at": b.completed_at,
        "decline_reason": b.decline_reason,
        "cancel_reason": b.cancel_reason,
        "cancelled_by": b.cancelled_by,
        "refund_due": b.refund_due,
        "created_at": b.created_at,
        "review": {"id": row.review_id, "rating": row.review_rating, "status": row.review_status}
        if show_review
        else None,
        "can_review": b.status == BookingStatus.completed
        and row.review_id is None
        and review_window_open(b.completed_at, now),
        "reschedule": {
            "start_at": b.reschedule_start_at,
            "end_at": b.reschedule_end_at,
            "expires_at": b.reschedule_expires_at,
            "requested_at": b.reschedule_requested_at,
        }
        if reschedule_pending(b, now)
        else None,
        "reschedule_declined_reason": b.reschedule_declined_reason,
    }
