import { Injectable, Logger } from '@nestjs/common';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class SqsService {
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private readonly logger = new Logger(SqsService.name);

  constructor(private readonly config: AppConfigService) {
    const clientConfig: ConstructorParameters<typeof SQSClient>[0] = {
      region: config.awsRegion,
    };

    if (config.useLocalstack) {
      clientConfig.endpoint = config.localstackEndpoint;
      clientConfig.credentials = {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      };
    }

    this.client = new SQSClient(clientConfig);
    this.queueUrl = config.sqsQueueUrl;
  }

  /**
   * Send a message to the orchestrator jobs queue.
   */
  async sendMessage(body: Record<string, unknown>): Promise<string | undefined> {
    const result = await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(body),
      }),
    );

    this.logger.log(`Sent message: ${result.MessageId}`);
    return result.MessageId;
  }

  /**
   * Long-poll for messages from the queue.
   * WaitTimeSeconds=20 is cost-critical (not performance).
   */
  async receiveMessages(maxMessages: number = 10): Promise<Message[]> {
    const result = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 300, // Must exceed max graph runtime (~120s)
      }),
    );

    return result.Messages || [];
  }

  /**
   * Delete a successfully processed message from the queue.
   */
  async deleteMessage(receiptHandle: string): Promise<void> {
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
  }
}
