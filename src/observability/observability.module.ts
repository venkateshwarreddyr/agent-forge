import { Global, Module } from '@nestjs/common';
import { TracingService } from './tracing.service';
import { LoggingService } from './logging.service';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  providers: [TracingService, LoggingService, MetricsService],
  exports: [TracingService, LoggingService, MetricsService],
})
export class ObservabilityModule {}
