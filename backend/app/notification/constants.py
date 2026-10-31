from typing import Literal

Kind = Literal[
    "booking_requested",
    "booking_accepted",
    "booking_declined",
    "booking_cancelled",
    "reschedule_requested",
    "reschedule_accepted",
    "reschedule_declined",
    "enquiry_received",
    "quote_received",
    "quote_accepted",
    "enquiry_declined",
    "order_placed",
    "order_confirmed",
    "order_shipped",
    "order_delivered",
    "order_cancelled",
    "chat_message",
    "support_reply",
    "requirement_due",
    "requirement_on_hold",
    "requirement_reminder",
    # admin console
    "artist_submitted",
    "ticket_opened",
    "post_reported",
    "subcategory_suggested",
    # admin broadcast
    "announcement",
]
TITLE_MAX = 120
BODY_MAX = 300
LINK_MAX = 200
TOKEN_MAX = 200
PENDING_PUSH = "pending_push"  # session.info key: pushes to send once the transaction commits
ANNOUNCEMENT: Kind = "announcement"
