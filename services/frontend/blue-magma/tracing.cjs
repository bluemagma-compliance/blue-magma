'use strict';

const http = require('http');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { defaultResource, resourceFromAttributes } = require('@opentelemetry/resources');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

const serviceName = process.env.OTEL_SERVICE_NAME || 'blue-magma-frontend';
const environment =
  process.env.OTEL_ENVIRONMENT ||
  process.env.ENVIRONMENT ||
  process.env.NODE_ENV ||
  'development';

let endpoint =
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

// If no endpoint is configured, skip SDK initialization (no-op).
if (!endpoint) {
  // Keep this quiet in production; it's mainly useful during local debugging.
  console.log('[otel] No OTLP endpoint configured for frontend; telemetry disabled.');
  return;
}

// If the endpoint does not start with http/https, assume host:port and
// construct the OTLP/HTTP traces endpoint.
if (!endpoint.startsWith('http')) {
  endpoint = `http://${endpoint}/v1/traces`;
}

const traceExporter = new OTLPTraceExporter({ url: endpoint });

const resource = defaultResource().merge(
	resourceFromAttributes({
		'service.name': serviceName,
		'deployment.environment': environment,
	}),
);

	function renameHttpSpan(span, request, response) {
		// Only adjust incoming SERVER spans; outgoing CLIENT spans use IncomingMessage
		// as response, so we skip those.
		if (!(response instanceof http.ServerResponse)) {
			return;
		}

		const method = request.method || 'GET';
		const rawUrl = request.url || '/';
		const path = rawUrl.split('?')[0] || '/';

		// Ignore noisy internal Next.js assets and favicon
		if (path.startsWith('/_next') || path === '/favicon.ico') {
			return;
		}

		// Give distinct names only to the two super-admin API routes for now (option A).
		if (path === '/super-admin/api/login') {
			span.updateName('super_admin_login_flow');
			return;
		}
		if (path === '/super-admin/api/verify-2fa') {
			span.updateName('super_admin_verify_2fa_flow');
			return;
		}

		// For all other routes, leave the default GET/POST naming intact.
	}

	const sdk = new NodeSDK({
		resource,
		traceExporter,
		instrumentations: [
			getNodeAutoInstrumentations({
				'@opentelemetry/instrumentation-http': {
					applyCustomAttributesOnSpan: (span, request, response) => {
						try {
							renameHttpSpan(span, request, response);
						} catch (error) {
							// Avoid breaking the app if the hook throws for some reason.
							console.error('[otel] Error in HTTP span renaming hook:', error);
						}
					},
				},
			}),
		],
	});

(async () => {
	try {
		await sdk.start();
		console.log(
			`[otel] NodeSDK initialized for ${serviceName}, exporting traces to ${endpoint}`,
		);
	} catch (error) {
		console.error('[otel] Error initializing OpenTelemetry NodeSDK for frontend:', error);
	}
})();

process.on('SIGTERM', () => {
	(async () => {
		try {
			await sdk.shutdown();
			console.log(
				'[otel] OpenTelemetry NodeSDK for frontend shut down successfully.',
			);
			process.exit(0);
		} catch (error) {
			console.error(
				'[otel] Error shutting down OpenTelemetry NodeSDK for frontend:',
				error,
			);
			process.exit(1);
		}
	})();
});

