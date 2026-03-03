import { Module } from '@nestjs/common';
import { ConsumerService } from './consumer.service';
import { ExecutorService } from './executor.service';
import { GraphModule } from '../graph/graph.module';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [GraphModule, StorageModule, QueueModule],
  providers: [ConsumerService, ExecutorService],
  exports: [ConsumerService],
})
export class WorkerModule {}
