"""Startup guards in Settings: configuration mistakes fail at boot, not at the first request."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_mock_payments_refuse_to_run_without_debug():
    with pytest.raises(ValidationError, match="only runs with DEBUG=true"):
        Settings(debug=False)
    assert Settings(debug=True).payment_provider == "mock"


def test_unknown_payment_provider_is_rejected():
    with pytest.raises(ValidationError, match="Unknown PAYMENT_PROVIDER"):
        Settings(payment_provider="razorpay")
