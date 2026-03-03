import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { AppConfigService } from '../config/config.service';
import { RunItem, fromDynamoItem, toDynamoItem } from './schemas/run-item.interface';

@Injectable()
export class DynamoDBService {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly logger = new Logger(DynamoDBService.name);

  constructor(private readonly config: AppConfigService) {
    const clientConfig: ConstructorParameters<typeof DynamoDBClient>[0] = {
      region: config.awsRegion,
    };

    if (config.useLocalstack) {
      clientConfig.endpoint = config.localstackEndpoint;
      clientConfig.credentials = {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      };
    }

    const client = new DynamoDBClient(clientConfig);
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.tableName = config.dynamodbTableName;
  }

  /**
   * Create a new run item in DynamoDB.
   */
  async createRun(runId: string, requirements: string): Promise<RunItem> {
    const now = new Date().toISOString();
    const item: RunItem = {
      run_id: runId,
      sk: 'RUN',
      status: 'pending',
      requirements,
      plan: null,
      code: null,
      review: null,
      tests: [],
      test_results: null,
      quality_score: null,
      revision_count: 0,
      token_usage: {},
      total_cost_usd: 0,
      errors: [],
      last_error: null,
      created_at: now,
      updated_at: now,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toDynamoItem(item),
      }),
    );

    this.logger.log(`Created run: ${runId}`);
    return item;
  }

  /**
   * Get a run by ID.
   */
  async getRun(runId: string): Promise<RunItem | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { run_id: runId, sk: 'RUN' },
      }),
    );

    if (!result.Item) return null;
    return fromDynamoItem(result.Item);
  }

  /**
   * Update specific fields on a run.
   */
  async updateRun(runId: string, updates: Partial<RunItem>): Promise<void> {
    const expressionParts: string[] = [];
    const expressionNames: Record<string, string> = {};
    const expressionValues: Record<string, unknown> = {};

    // Always update updated_at
    updates.updated_at = new Date().toISOString();

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'run_id' || key === 'sk') continue;

      const attrName = `#${key}`;
      const attrValue = `:${key}`;
      expressionParts.push(`${attrName} = ${attrValue}`);
      expressionNames[attrName] = key;
      expressionValues[attrValue] = value;
    }

    if (expressionParts.length === 0) return;

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { run_id: runId, sk: 'RUN' },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
      }),
    );

    this.logger.debug(`Updated run: ${runId}`);
  }

  /**
   * List runs by status using the GSI (status-createdAt-index).
   */
  async listRunsByStatus(
    status: string,
    limit: number = 20,
  ): Promise<RunItem[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'status-createdAt-index',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status },
        ScanIndexForward: false, // newest first
        Limit: limit,
      }),
    );

    return (result.Items || []).map((item) => fromDynamoItem(item));
  }

  /**
   * Simple connectivity check for health endpoint.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { run_id: '__health_check__', sk: 'RUN' },
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
