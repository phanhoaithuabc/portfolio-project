import { NodeSDK } from "@opentelemetry/sdk-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
if (process.env.OTEL_ENABLED === "true") {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": process.env.SERVICE ?? "portfolio",
      "deployment.environment.name": process.env.APP_ENV ?? "dev",
    }),
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new UndiciInstrumentation(),
    ],
  });
  sdk.start();
  process.once("SIGTERM", () => {
    void sdk.shutdown();
  });
}
