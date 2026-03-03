import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RunsController } from './controllers/runs.controller';
import { HealthController } from './controllers/health.controller';
import { RequestLoggingInterceptor } from './interceptors/request-logging.interceptor';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [StorageModule, QueueModule],
  controllers: [RunsController, HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class ApiModule {}
