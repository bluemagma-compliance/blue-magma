import os
from typing import Callable, Optional

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.propagate import set_global_textmap
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased, ParentBased, ALWAYS_ON
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor


def _build_resource() -> Resource:
    service_name = os.getenv("OTEL_SERVICE_NAME", "graphlang-agent")
    env = os.getenv("OTEL_ENVIRONMENT") or os.getenv("ENVIRONMENT") or "development"

    return Resource.create(
        {
            "service.name": service_name,
            "deployment.environment": env,
        }
    )


def _build_sampler():
    sampler_name = os.getenv("OTEL_TRACES_SAMPLER", "").lower()
    if sampler_name == "parentbased_traceidratio":
        arg = os.getenv("OTEL_TRACES_SAMPLER_ARG") or "1.0"
        try:
            ratio = float(arg)
        except ValueError:
            ratio = 1.0
        return ParentBased(TraceIdRatioBased(ratio))
    return ALWAYS_ON


def init_telemetry() -> Callable[[], None]:
    """Initialize OpenTelemetry tracing for the agent.

    This is vendor-neutral: configuration is driven by OTEL_* environment
    variables and data is exported via OTLP/HTTP to the collector.
    """

    resource = _build_resource()
    sampler = _build_sampler()

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") or os.getenv(
        "OTEL_EXPORTER_OTLP_ENDPOINT"
    )

    # If no endpoint is configured, install a provider without exporters so
    # that instrumentation is active but nothing is sent anywhere.
    if not endpoint:
        provider = TracerProvider(resource=resource, sampler=sampler)
        trace.set_tracer_provider(provider)
        set_global_textmap(TraceContextTextMapPropagator())
        return lambda: None

    if not endpoint.startswith("http"):
        # Assume host:port and build the OTLP/HTTP traces endpoint.
        endpoint = f"http://{endpoint}/v1/traces"

    # For the HTTP OTLP exporter, TLS vs non-TLS is determined by the
    # endpoint scheme (http/https). The 'insecure' flag is only relevant for
    # the gRPC exporter, so we don't pass it here.
    exporter = OTLPSpanExporter(endpoint=endpoint)

    provider = TracerProvider(resource=resource, sampler=sampler)
    processor = BatchSpanProcessor(exporter)
    provider.add_span_processor(processor)

    trace.set_tracer_provider(provider)
    set_global_textmap(TraceContextTextMapPropagator())

    def shutdown() -> None:
        provider.shutdown()

    return shutdown


def instrument_fastapi(app: Optional[FastAPI]) -> None:
    """Attach FastAPI/ASGI instrumentation to the given app."""

    if app is None:
        return
    FastAPIInstrumentor.instrument_app(app)


def instrument_clients() -> None:
    """Instrument common client libraries used by the agent.

    - requests: outbound HTTP calls to the backend API
    - redis: Redis session persistence
    """

    RequestsInstrumentor().instrument()
    RedisInstrumentor().instrument()

