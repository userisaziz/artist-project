# syntax=docker/dockerfile:1.7
# Production image for the Art Circle API.
#   docker build -t art-circle-api backend/
#   docker run --env-file .env -p 8000:8000 art-circle-api                   # the API
#   docker run --env-file .env art-circle-api alembic upgrade head            # migrations: a separate release step
#   docker run --env-file .env art-circle-api python -m scripts.maintenance   # housekeeping, from a scheduler

FROM python:3.14-slim AS build
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1
WORKDIR /build
COPY requirements.lock .
RUN python -m venv /venv && /venv/bin/pip install --require-virtualenv -r requirements.lock

FROM python:3.14-slim AS runtime
ENV PATH="/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production \
    WEB_CONCURRENCY=2
RUN groupadd --system app && useradd --system --gid app --home-dir /app --no-create-home app
WORKDIR /app
COPY --from=build /venv /venv
COPY --chown=app:app alembic.ini ./
COPY --chown=app:app alembic ./alembic
COPY --chown=app:app app ./app
COPY --chown=app:app scripts ./scripts
USER app
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(urllib.request.urlopen('http://127.0.0.1:8000/health/live', timeout=2).status != 200)"]
# --proxy-headers: behind the load balancer, client IPs (rate limits, logs) come from X-Forwarded-For,
# trusted only from FORWARDED_ALLOW_IPS (required in production; the app refuses to boot without it).
# Graceful shutdown lets in-flight requests finish on deploy.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY} --proxy-headers --forwarded-allow-ips ${FORWARDED_ALLOW_IPS:-127.0.0.1} --timeout-graceful-shutdown 20 --no-server-header"]
