from typing import Literal

Kind = Literal[
    "booking_requested",
    "booking_accepted",
    "booking_declined",
    "booking_cancelled",
    "order_placed",
    "order_confirmed",
    "order_shipped",
    "order_delivered",
    "order_cancelled",
    "chat_message",
    "support_reply",
]
TITLE_MAX = 120
BODY_MAX = 300
LINK_MAX = 200
TOKEN_MAX = 200
PENDING_PUSH = "pending_push"  # session.info key: pushes to send once the transaction commits
