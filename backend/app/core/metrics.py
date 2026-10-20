"""Prometheus metrics: request count and latency per route template (never per raw path, which
would explode label cardinality). With several uvicorn workers set PROMETHEUS_MULTIPROC_DIR
(the image does), so a scrape of any worker reports the whole process group."""

import os

from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, CollectorRegistry, Counter, Histogram, generate_latest
from prometheus_client.multiprocess import MultiProcessCollector

REQUESTS = Counter("http_requests_total", "HTTP requests answered", ["method", "route", "status"])
LATENCY = Histogram(
    "http_request_duration_seconds",
    "Time to answer an HTTP request",
    ["method", "route"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
UNMATCHED = "unmatched"  # 404s and probes for paths we don't serve all share one label


def observe(method: str, route: str | None, status: int, seconds: float) -> None:
    label = route or UNMATCHED
    REQUESTS.labels(method, label, str(status)).inc()
    LATENCY.labels(method, label).observe(seconds)


def render() -> tuple[bytes, str]:
    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        registry = CollectorRegistry()
        MultiProcessCollector(registry)
        return generate_latest(registry), CONTENT_TYPE_LATEST
    return generate_latest(REGISTRY), CONTENT_TYPE_LATEST
