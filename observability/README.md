## Observability configuration

This folder contains OpenTelemetry Collector configuration used by the Blue Magma stack. All application services emit telemetry to the collector via OTLP/HTTP; the collector is the only place that knows about specific vendors (e.g. Datadog).

### Files

- `otel-collector-config.template.yaml`
  - Vendor-neutral template.
  - Receives OTLP traffic on `0.0.0.0:4318`.
  - Exports traces only to the `debug` exporter (collector logs) by default.
  - Metrics pipeline is defined but has no exporters configured.
  - Intended as a safe starting point for any OTLP-compatible backend.

- `otel-collector-config.datadog.yaml`
  - Datadog-specific configuration.
  - Uses the same OTLP receiver as the template.
  - Adds the `datadog` exporter for traces and metrics.
  - Reads credentials from environment variables:
    - `DD_API_KEY` – Datadog API key.
    - `DD_SITE` – Datadog site (e.g. `us3.datadoghq.com`, `datadoghq.eu`).

### Docker Compose usage

The main `docker-compose.yaml` mounts the **vendor-neutral** template by default:

- Neutral / OSS-friendly mode (collector logs telemetry to stdout only):

  ```bash
  docker compose up -d
  ```

To send telemetry to Datadog, use the small override file `docker-compose.datadog.yaml` which only swaps the collector config to the Datadog variant:

- Datadog mode:

  ```bash
  docker compose -f docker-compose.yaml -f docker-compose.datadog.yaml up -d
  ```

### Customizing for other vendors

To integrate with a different observability backend:

1. Start from `otel-collector-config.template.yaml`.
2. Add an exporter block for your vendor under `exporters:`.
3. Reference that exporter in the `service.pipelines.traces.exporters` and/or `service.pipelines.metrics.exporters` lists.
4. Update your Compose file (or create another override) to mount your customized config.

