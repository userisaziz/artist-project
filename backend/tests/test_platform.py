"""HTTP edge contract: request ids, security headers, one error shape for every failure, probes, body limit."""

import json
import logging

from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.logging import JsonFormatter, RequestIdFilter, request_id_var
from app.main import create_app


async def test_every_response_carries_a_request_id(client):
    response = await client.get("/health/live")
    assert len(response.headers["x-request-id"]) == 32


async def test_a_safe_caller_request_id_is_echoed_and_an_unsafe_one_replaced(client):
    kept = await client.get("/health/live", headers={"X-Request-ID": "mobile-1234abcd"})
    assert kept.headers["x-request-id"] == "mobile-1234abcd"
    replaced = await client.get("/health/live", headers={"X-Request-ID": "<script>"})
    assert replaced.headers["x-request-id"] != "<script>"


async def test_security_headers_are_set(client):
    headers = (await client.get("/health/live")).headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
    assert headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"
    assert headers["cache-control"] == "no-store"
    assert "max-age" in headers["strict-transport-security"]


async def test_unknown_route_uses_the_error_contract(client):
    response = await client.get("/api/v1/nope")
    assert response.status_code == 404
    assert response.json() == {"code": "not_found", "message": "Not Found"}


async def test_validation_errors_use_the_error_contract_without_echoing_input(client):
    response = await client.post("/api/v1/auth/otp/request", json={"phone": "secret-not-a-phone"})
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["message"]
    assert body["detail"][0]["loc"] == ["body", "phone"]
    assert "secret-not-a-phone" not in response.text


async def test_unexpected_errors_return_a_generic_500_with_the_request_id(engine):
    app = create_app()

    @app.get("/boom")
    async def boom():
        raise RuntimeError("database password is hunter2")

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/boom", headers={"X-Request-ID": "trace-12345678"})
    assert response.status_code == 500
    assert response.json() == {
        "code": "internal_error",
        "message": "Something went wrong on our side.",
        "request_id": "trace-12345678",
    }
    assert "hunter2" not in response.text


async def test_oversized_bodies_are_refused(client):
    response = await client.post(
        "/api/v1/auth/otp/request",
        content=b"{" + b" " * 2_000_000 + b"}",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert response.json()["code"] == "payload_too_large"


async def test_liveness_and_readiness(client):
    assert (await client.get("/health/live")).json() == {"status": "ok"}
    assert (await client.get("/health/ready")).json() == {"status": "ok", "db": "ok"}


async def test_readiness_is_503_when_the_database_is_down(client, override):
    class DownSession:
        async def execute(self, *_):
            raise OSError("connection refused")

    async def down():
        yield DownSession()

    override(get_db, down)
    response = await client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["code"] == "service_unavailable"


def test_json_log_lines_carry_the_request_id():
    token = request_id_var.set("req-abc12345")
    try:
        record = logging.LogRecord("art_circle.test", logging.INFO, __file__, 1, "hello %s", ("world",), None)
        record.status = 201
        RequestIdFilter().filter(record)
        line = json.loads(JsonFormatter().format(record))
    finally:
        request_id_var.reset(token)
    assert (line["message"], line["request_id"], line["status"], line["level"]) == (
        "hello world",
        "req-abc12345",
        201,
        "INFO",
    )


async def test_last_resort_500_still_carries_request_id_and_security_headers(engine):
    app = create_app()

    @app.get("/boom")
    async def boom():
        raise RuntimeError("nope")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/boom")
    assert response.status_code == 500
    assert response.headers["x-request-id"] == response.json()["request_id"]
    assert response.headers["x-content-type-options"] == "nosniff"


def test_the_app_engine_points_at_the_test_database():
    from app.core.database import engine
    from tests.conftest import settings

    assert engine.url.render_as_string(hide_password=False) == settings.test_database_url


async def test_writes_commit_before_the_response_is_sent(engine, override):
    """A client must never see 200/201 for a write that later fails to commit."""
    from sqlalchemy import event
    from sqlalchemy.orm import Session

    from tests.support.auth import PHONE, sign_in

    app = create_app()
    order: list[str] = []

    async def record_start(scope, receive, send):
        async def tracking(message):
            if message["type"] == "http.response.start":
                order.append("response")
            await send(message)

        await app(scope, receive, tracking)

    from tests.conftest import TestSessionFactory

    async def test_db():
        async with TestSessionFactory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = test_db
    async with AsyncClient(transport=ASGITransport(app=record_start), base_url="http://test") as ac:
        headers = await sign_in(ac, PHONE, role=None)

        def on_commit(session):
            order.append("commit")

        event.listen(Session, "after_commit", on_commit)
        try:
            order.clear()
            response = await ac.patch("/api/v1/users/me", headers=headers, json={"first_name": "Meera"})
        finally:
            event.remove(Session, "after_commit", on_commit)
    assert response.status_code == 200
    assert order[-1] == "response" and "commit" in order
