import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppConfigModule } from './config/config.module';
import { ObservabilityModule } from './observability/observability.module';
import { ApiModule } from './api/api.module';
import { GraphModule } from './graph/graph.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { WorkerModule } from './worker/worker.module';

@Module({
  imports: [
    AppConfigModule,
    ObservabilityModule,
    StorageModule,
    QueueModule,
    GraphModule,
    WorkerModule,
    ApiModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/run(.*)', '/health', '/metrics'],
    }),
  ],
})
export class AppModule {}
