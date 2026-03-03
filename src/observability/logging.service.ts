import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import pino, { Logger as PinoLogger } from 'pino';
import { trace } from '@opentelemetry/api';

/**
 * Create a Pino logger instance with OTel trace context injection.
 * Every log line includes trace_id and span_id for CloudWatch Logs Insights correlation.
 */
function createLogger(): PinoLogger {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    mixin() {
      const span = trace.getActiveSpan();
      if (span) {
        const ctx = span.spanContext();
        return {
          trace_id: ctx.traceId,
          span_id: ctx.spanId,
        };
      }
      return {};
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

@Injectable()
export class LoggingService implements NestLoggerService {
  private readonly logger: PinoLogger;

  constructor() {
    this.logger = createLogger();
  }

  log(message: string, ...optionalParams: unknown[]) {
    this.logger.info(this.buildLogObject(optionalParams), message);
  }

  error(message: string, ...optionalParams: unknown[]) {
    this.logger.error(this.buildLogObject(optionalParams), message);
  }

  warn(message: string, ...optionalParams: unknown[]) {
    this.logger.warn(this.buildLogObject(optionalParams), message);
  }

  debug(message: string, ...optionalParams: unknown[]) {
    this.logger.debug(this.buildLogObject(optionalParams), message);
  }

  verbose(message: string, ...optionalParams: unknown[]) {
    this.logger.trace(this.buildLogObject(optionalParams), message);
  }

  /**
   * Get a child logger with additional context fields bound.
   */
  child(bindings: Record<string, unknown>): PinoLogger {
    return this.logger.child(bindings);
  }

  private buildLogObject(params: unknown[]): Record<string, unknown> {
    if (params.length === 0) return {};
    if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
      return params[0] as Record<string, unknown>;
    }
    if (params.length === 1 && typeof params[0] === 'string') {
      return { context: params[0] };
    }
    return { params };
  }
}
