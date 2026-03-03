import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SqsService } from '../queue/sqs.service';
import { ExecutorService } from './executor.service';

@Injectable()
export class ConsumerService implements OnModuleDestroy {
  private readonly logger = new Logger(ConsumerService.name);
  private running = false;

  constructor(
    private readonly sqs: SqsService,
    private readonly executor: ExecutorService,
  ) {}

  /**
   * Start the SQS long-poll consumer loop.
   * Called from main.ts when ORCHESTRATOR_MODE=worker.
   */
  async start(): Promise<void> {
    this.running = true;
    this.logger.log('SQS consumer started');

    // Graceful shutdown on SIGTERM/SIGINT
    const shutdown = () => {
      this.logger.log('Received shutdown signal, stopping consumer...');
      this.running = false;
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    while (this.running) {
      try {
        const messages = await this.sqs.receiveMessages(10);

        if (messages.length === 0) continue;

        this.logger.log(`Received ${messages.length} message(s)`);

        // Process messages concurrently (async/await replaces Python ThreadPoolExecutor)
        const results = await Promise.allSettled(
          messages.map(async (message) => {
            try {
              await this.processMessage(message);
              // Delete on success
              if (message.ReceiptHandle) {
                await this.sqs.deleteMessage(message.ReceiptHandle);
              }
            } catch (error) {
              // Do NOT delete — message will become visible again after VisibilityTimeout
              const msg = error instanceof Error ? error.message : String(error);
              this.logger.error(`Failed to process message ${message.MessageId}: ${msg}`);
            }
          }),
        );

        const succeeded = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          this.logger.warn(`Batch: ${succeeded} succeeded, ${failed} failed`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Consumer loop error: ${msg}`);
        // Brief pause before retrying to avoid tight error loop
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    this.logger.log('SQS consumer stopped');
  }

  /**
   * Process a single SQS message.
   */
  private async processMessage(message: { Body?: string; MessageId?: string }): Promise<void> {
    if (!message.Body) {
      this.logger.warn(`Empty message body: ${message.MessageId}`);
      return;
    }

    const body = JSON.parse(message.Body) as { run_id: string; requirements: string };
    this.logger.log(`Processing run: ${body.run_id}`);

    await this.executor.execute(body.run_id, body.requirements);
  }

  onModuleDestroy() {
    this.running = false;
  }
}
