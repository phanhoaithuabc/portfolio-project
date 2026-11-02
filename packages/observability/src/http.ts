import type { Express } from "express";
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";
import pino from "pino";
import { trace } from "@opentelemetry/api";
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: process.env.SERVICE ?? "portfolio" },
  redact: ["password", "customer", "authorization", "DATABASE_URL"],
});
export function instrument(app: Express, service: string) {
  const registry = new Registry();
  registry.setDefaultLabels({ service });
  collectDefaultMetrics({ register: registry });
  const requests = new Counter({
    name: "portfolio_http_requests_total",
    help: "Completed HTTP requests",
    labelNames: ["method", "route", "status"],
    registers: [registry],
  });
  const duration = new Histogram({
    name: "portfolio_http_duration_seconds",
    help: "HTTP response duration",
    labelNames: ["method", "route"],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20],
    registers: [registry],
  });
  app.get("/metrics", async (_request, response) => {
    response.type(registry.contentType).send(await registry.metrics());
  });
  app.use((request, response, next) => {
    if (["/health", "/ready", "/api/health"].includes(request.path))
      return next();
    const start = performance.now();
    const traceId = trace.getActiveSpan()?.spanContext().traceId;
    response.once("finish", () => {
      const route =
        request.route?.path ?? (service === "gateway" ? "/api" : "unmatched");
      const seconds = (performance.now() - start) / 1000;
      requests.inc({
        method: request.method,
        route,
        status: String(response.statusCode),
      });
      duration.observe({ method: request.method, route }, seconds);
      logger.info(
        {
          method: request.method,
          route,
          status: response.statusCode,
          durationMs: Math.round(seconds * 1000),
          traceId,
        },
        "http_request",
      );
    });
    next();
  });
  return registry;
}
