"""The review auto-filter: contact details and blocked words hide a review until a moderator looks."""

import pytest

from app.utils.review_filter import review_flag


@pytest.mark.parametrize("text", [
    "Call her on 98450 67890 for a discount",
    "My number +91-98450-67890",
    "+919845067890 whatsapp",
    "ref 12345678901234",
    "write to ayesha.art@gmail.com",
    "follow @ayesha.mehendi for more",
    "see https://example.com/portfolio",
    "www.example.com has her work",
    "(98450) 12345",
    "98450.12345",
    "(555) 123-4567",
    "msg me at wa.me/919845067890",
    "find her at foo.com",
])
def test_contact_details_are_caught(text):
    assert review_flag(text) == "contact_info"


@pytest.mark.parametrize("text", ["Total SCAM, avoid", "this was fraud", "just call me later", "WhatsApp me for photos"])
def test_blocked_words_are_caught(text):
    assert review_flag(text) == "blocked_word"


@pytest.mark.parametrize("text", [
    "Lovely work, ₹5,500 well spent. She arrived at 11 AM sharp.",
    "Booked for 25 guests on 17/10/2026, 4 hours, 5 stars",
    "Scampi at the wedding was great",  # "scam" only as a whole word
    "Booked 15-10-2026 11:00, done by 2 PM",
    "Paid on 12-10-2026 10 am",
    "Rs 1500 2000 3000 total for three of us",
    "4.5 hours, 120 guests, 2 days",
    None,
    "",
])
def test_clean_reviews_pass(text):
    assert review_flag(text) is None
