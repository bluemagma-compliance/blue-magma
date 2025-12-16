package observability

import (
	"context"
	"os"
	"strconv"
	"strings"

	"github.com/gofiber/contrib/otelfiber"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/extra/redisotel/v9"
	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
	gormotel "go.bryk.io/pkg/otel/gorm"
	"gorm.io/gorm"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

// Init configures OpenTelemetry tracing and propagation for the service.
// It is vendor-neutral and only depends on OTLP/HTTP and standard OTEL_* env vars.
func Init(ctx context.Context) (func(context.Context) error, error) {
	serviceName := os.Getenv("OTEL_SERVICE_NAME")
	if serviceName == "" {
		serviceName = "blue-magma-api"
	}

	env := os.Getenv("OTEL_ENVIRONMENT")
	if env == "" {
		env = os.Getenv("ENVIRONMENT")
	}
	if env == "" {
		env = "development"
	}

	res, err := resource.New(
		ctx,
		resource.WithFromEnv(),
		resource.WithTelemetrySDK(),
		resource.WithHost(),
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.DeploymentEnvironment(env),
		),
	)
	if err != nil {
		log.WithError(err).Warn("failed to create OpenTelemetry resource, using default")
		res = resource.Default()
	}

	// Default to always sampling if an exporter is configured; otherwise never sample.
	sampler := sdktrace.AlwaysSample()
	if strings.EqualFold(os.Getenv("OTEL_TRACES_SAMPLER"), "parentbased_traceidratio") {
		if arg := os.Getenv("OTEL_TRACES_SAMPLER_ARG"); arg != "" {
			if ratio, err := strconv.ParseFloat(arg, 64); err == nil {
				sampler = sdktrace.ParentBased(sdktrace.TraceIDRatioBased(ratio))
			}
		}
	}

	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

	var tp *sdktrace.TracerProvider
	var mp *sdkmetric.MeterProvider
	shutdownFuncs := []func(context.Context) error{}

	if endpoint == "" {
		// No endpoint configured: install lightweight providers that never export.
		tp = sdktrace.NewTracerProvider(
			sdktrace.WithSampler(sdktrace.NeverSample()),
			sdktrace.WithResource(res),
		)
		mp = sdkmetric.NewMeterProvider(
			sdkmetric.WithResource(res),
		)
	} else {
		traceClientOpts := []otlptracehttp.Option{
			otlptracehttp.WithEndpoint(endpoint),
		}
		metricClientOpts := []otlpmetrichttp.Option{
			otlpmetrichttp.WithEndpoint(endpoint),
		}

		insecure := os.Getenv("OTEL_EXPORTER_OTLP_INSECURE")
		if insecure == "true" || insecure == "1" {
			traceClientOpts = append(traceClientOpts, otlptracehttp.WithInsecure())
			metricClientOpts = append(metricClientOpts, otlpmetrichttp.WithInsecure())
		}

		traceExporter, err := otlptracehttp.New(ctx, traceClientOpts...)
		if err != nil {
			return nil, err
		}

		metricExporter, err := otlpmetrichttp.New(ctx, metricClientOpts...)
		if err != nil {
			return nil, err
		}

		reader := sdkmetric.NewPeriodicReader(metricExporter)
		mp = sdkmetric.NewMeterProvider(
			sdkmetric.WithReader(reader),
			sdkmetric.WithResource(res),
		)

		tp = sdktrace.NewTracerProvider(
			sdktrace.WithBatcher(traceExporter),
			sdktrace.WithResource(res),
			sdktrace.WithSampler(sampler),
		)

		shutdownFuncs = append(shutdownFuncs, traceExporter.Shutdown, mp.Shutdown)
	}

	otel.SetTracerProvider(tp)
	if mp != nil {
		otel.SetMeterProvider(mp)
	}
	otel.SetTextMapPropagator(
		propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		),
	)

	// Compose a shutdown that attempts all component shutdowns and returns
	// the first error (if any).
	return func(c context.Context) error {
		// Always attempt to shut down the tracer provider.
		var firstErr error
		if err := tp.Shutdown(c); err != nil && firstErr == nil {
			firstErr = err
		}
		for _, fn := range shutdownFuncs {
			if err := fn(c); err != nil && firstErr == nil {
				firstErr = err
			}
		}
		return firstErr
	}, nil
}

// InstrumentFiber adds OpenTelemetry tracing and metrics to the Fiber app.
func InstrumentFiber(app *fiber.App) {
	if app == nil {
		return
	}
	app.Use(otelfiber.Middleware())
}

// InstrumentGorm attaches OpenTelemetry instrumentation to the given GORM DB.
func InstrumentGorm(db *gorm.DB, dbName string) {
	if db == nil {
		return
	}

	plugin := gormotel.Plugin(gormotel.WithDBName(dbName))
	if err := db.Use(plugin); err != nil {
		log.WithError(err).Warn("failed to register GORM OpenTelemetry plugin")
	}
}

// InstrumentRedisClient enables OpenTelemetry tracing and metrics for the Redis client.
func InstrumentRedisClient(client *redis.Client) {
	if client == nil {
		return
	}

	if err := redisotel.InstrumentTracing(client); err != nil {
		log.WithError(err).Warn("failed to enable Redis tracing")
	}

	if err := redisotel.InstrumentMetrics(client); err != nil {
		log.WithError(err).Warn("failed to enable Redis metrics")
	}
}
