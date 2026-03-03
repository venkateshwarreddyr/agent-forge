import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { TracingService } from '../../observability/tracing.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly tracing: TracingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<Request>();
    const response = httpCtx.getResponse<Response>();

    const requestId = uuidv4();
    const startTime = Date.now();

    // Inject request ID header
    response.setHeader('X-Request-Id', requestId);

    // Create OTel span for request
    const span = this.tracing.startSpan(`HTTP ${request.method} ${request.path}`, {
      'http.method': request.method,
      'http.url': request.url,
      'http.request_id': requestId,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          this.logger.log({
            message: 'request_completed',
            method: request.method,
            path: request.path,
            status_code: response.statusCode,
            duration_ms: durationMs,
            request_id: requestId,
          });
          span.setAttribute('http.status_code', response.statusCode);
          span.end();
        },
        error: (error) => {
          const durationMs = Date.now() - startTime;
          this.logger.error({
            message: 'request_failed',
            method: request.method,
            path: request.path,
            status_code: response.statusCode,
            duration_ms: durationMs,
            request_id: requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          span.end();
        },
      }),
    );
  }
}
