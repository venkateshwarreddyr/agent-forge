import { Injectable } from '@nestjs/common';
import { trace, Tracer, Span, SpanStatusCode, context } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;

export interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  otlpEndpoint: string;
}

/**
 * Initialise OpenTelemetry tracing. Must be called BEFORE NestFactory.create()
 * so all auto-instrumentation hooks are registered.
 */
export function initTracing(config: TracingConfig): void {
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: config.environment,
  });

  const exporter = new OTLPTraceExporter({
    url: `${config.otlpEndpoint}/v1/traces`,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: exporter,
  });

  sdk.start();
}

/**
 * Gracefully shut down OTel SDK (flush pending spans).
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
  }
}

@Injectable()
export class TracingService {
  private readonly tracer: Tracer;

  constructor() {
    this.tracer = trace.getTracer('orchestrator');
  }

  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Start a new span as a child of the current active span.
   */
  startSpan(name: string, attributes?: Record<string, string | number>): Span {
    const span = this.tracer.startSpan(name);
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
    }
    return span;
  }

  /**
   * Get the current trace ID from the active span (for log correlation).
   */
  getCurrentTraceId(): string | undefined {
    const span = trace.getActiveSpan();
    if (!span) return undefined;
    return span.spanContext().traceId;
  }

  getCurrentSpanId(): string | undefined {
    const span = trace.getActiveSpan();
    if (!span) return undefined;
    return span.spanContext().spanId;
  }
}

/**
 * Custom method decorator that wraps an async method in an OTel span.
 *
 * Usage:
 *   @Traced('planner')
 *   async invoke(state: AgentState): Promise<Partial<AgentState>> { ... }
 */
export function Traced(agentName: string) {
  return function (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const tracer = trace.getTracer('orchestrator');

      return tracer.startActiveSpan(`agent.${agentName}`, async (span: Span) => {
        span.setAttribute('agent.name', agentName);

        // Extract run_id from first argument if it looks like AgentState
        const state = args[0] as Record<string, unknown> | undefined;
        if (state?.runId) {
          span.setAttribute('run.id', String(state.runId));
        }
        if (state?.revisionCount !== undefined) {
          span.setAttribute('revision.count', Number(state.revisionCount));
        }

        try {
          const result = await originalMethod.apply(this, args);

          // Annotate span with output attributes
          if (result && typeof result === 'object') {
            const r = result as Record<string, unknown>;
            if (r.qualityScore !== undefined) {
              span.setAttribute('review.quality_score', Number(r.qualityScore));
            }
            if (typeof r.plan === 'string') {
              span.setAttribute('plan.length_chars', r.plan.length);
            }
            if (typeof r.code === 'string') {
              span.setAttribute('code.length_chars', r.code.length);
            }
          }

          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}
