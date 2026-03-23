/**
 * T162 — OpenTelemetry tracing bootstrap
 *
 * IMPORTANT: This module must be imported BEFORE any other application modules
 * in `index.ts` so that instrumentation patches are applied at startup.
 *
 * Trace export is controlled by OTEL_EXPORTER_OTLP_ENDPOINT env var.
 * If the variable is unset, the SDK still runs but no traces are exported.
 */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { MongooseInstrumentation } from '@opentelemetry/instrumentation-mongoose'
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http'

// Cast required: @opentelemetry/exporter-otlp-http@0.26 ships an older OTLPTraceExporter
// whose ReadableSpan type predates instrumentationLibrary removal in sdk-trace-base@2.x
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const exporter: any = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ? new OTLPTraceExporter({
      url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
    })
  : undefined

export const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'elearn-api',
  traceExporter: exporter,
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new MongooseInstrumentation(),
  ],
})

export function startTracing(): void {
  sdk.start()
}

export function stopTracing(): Promise<void> {
  return sdk.shutdown()
}
