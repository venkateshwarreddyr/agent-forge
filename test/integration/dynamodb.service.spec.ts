import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../../src/storage/dynamodb.service';
import { AppConfigService } from '../../src/config/config.service';

const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock AppConfigService
const mockConfig = {
  awsRegion: 'us-east-1',
  dynamodbTableName: 'orchestrator-runs',
  useLocalstack: false,
  localstackEndpoint: 'http://localhost:4566',
} as AppConfigService;

describe('DynamoDBService', () => {
  let service: DynamoDBService;

  beforeEach(() => {
    ddbMock.reset();
    service = new DynamoDBService(mockConfig);
  });

  describe('createRun', () => {
    it('creates a new run item', async () => {
      ddbMock.on(PutCommand).resolves({});

      const item = await service.createRun('run-123', 'Build a REST API');

      expect(item.run_id).toBe('run-123');
      expect(item.status).toBe('pending');
      expect(item.requirements).toBe('Build a REST API');
      expect(item.plan).toBeNull();
      expect(item.code).toBeNull();
      expect(item.created_at).toBeDefined();
    });

    it('sends correct PutCommand to DynamoDB', async () => {
      ddbMock.on(PutCommand).resolves({});

      await service.createRun('run-456', 'Test requirements');

      const calls = ddbMock.commandCalls(PutCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.TableName).toBe('orchestrator-runs');
      expect(calls[0].args[0].input.Item?.run_id).toBe('run-456');
      expect(calls[0].args[0].input.Item?.sk).toBe('RUN');
    });
  });

  describe('getRun', () => {
    it('returns a run item when found', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          run_id: 'run-123',
          sk: 'RUN',
          status: 'completed',
          requirements: 'Build an API',
          plan: 'A plan',
          code: 'print("hello")',
          review: null,
          tests: [],
          test_results: null,
          quality_score: 0.85,
          revision_count: 1,
          token_usage: { planner: 500 },
          total_cost_usd: 0.01,
          errors: [],
          last_error: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:01:00Z',
        },
      });

      const result = await service.getRun('run-123');

      expect(result).not.toBeNull();
      expect(result!.run_id).toBe('run-123');
      expect(result!.status).toBe('completed');
      expect(result!.quality_score).toBe(0.85);
    });

    it('returns null when run is not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const result = await service.getRun('nonexistent');
      expect(result).toBeNull();
    });

    it('sends correct key to DynamoDB', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await service.getRun('run-789');

      const calls = ddbMock.commandCalls(GetCommand);
      expect(calls[0].args[0].input.Key).toEqual({
        run_id: 'run-789',
        sk: 'RUN',
      });
    });
  });

  describe('updateRun', () => {
    it('updates specified fields', async () => {
      ddbMock.on(UpdateCommand).resolves({});

      await service.updateRun('run-123', { status: 'running' });

      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.Key).toEqual({ run_id: 'run-123', sk: 'RUN' });
      expect(calls[0].args[0].input.UpdateExpression).toContain('#status');
    });

    it('always updates updated_at even with empty updates', async () => {
      ddbMock.on(UpdateCommand).resolves({});

      await service.updateRun('run-123', {});

      const calls = ddbMock.commandCalls(UpdateCommand);
      // updated_at is always added, so even empty updates produce a call
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.UpdateExpression).toContain('updated_at');
    });
  });

  describe('listRunsByStatus', () => {
    it('queries the GSI for runs by status', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            run_id: 'run-1',
            sk: 'RUN',
            status: 'completed',
            requirements: 'Task 1',
            created_at: '2024-01-02T00:00:00Z',
            updated_at: '2024-01-02T00:01:00Z',
          },
          {
            run_id: 'run-2',
            sk: 'RUN',
            status: 'completed',
            requirements: 'Task 2',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:01:00Z',
          },
        ],
      });

      const results = await service.listRunsByStatus('completed', 20);

      expect(results).toHaveLength(2);
      expect(results[0].run_id).toBe('run-1');

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls[0].args[0].input.IndexName).toBe('status-createdAt-index');
      expect(calls[0].args[0].input.ScanIndexForward).toBe(false);
    });

    it('returns empty array when no runs found', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const results = await service.listRunsByStatus('failed');
      expect(results).toEqual([]);
    });
  });

  describe('healthCheck', () => {
    it('returns true when DynamoDB is accessible', async () => {
      ddbMock.on(GetCommand).resolves({});

      const healthy = await service.healthCheck();
      expect(healthy).toBe(true);
    });

    it('returns false when DynamoDB is not accessible', async () => {
      ddbMock.on(GetCommand).rejects(new Error('Connection refused'));

      const healthy = await service.healthCheck();
      expect(healthy).toBe(false);
    });
  });
});
