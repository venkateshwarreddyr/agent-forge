import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { RunsController } from '../../src/api/controllers/runs.controller';
import { DynamoDBService } from '../../src/storage/dynamodb.service';
import { SqsService } from '../../src/queue/sqs.service';

describe('RunsController (integration)', () => {
  let app: INestApplication;
  let dynamoDbService: Partial<DynamoDBService>;
  let sqsService: Partial<SqsService>;

  beforeEach(async () => {
    dynamoDbService = {
      createRun: jest.fn().mockResolvedValue({
        run_id: 'test-run-id',
        sk: 'RUN',
        status: 'pending',
        requirements: 'Build a REST API for user management',
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
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }),
      getRun: jest.fn(),
      listRunsByStatus: jest.fn(),
    };

    sqsService = {
      sendMessage: jest.fn().mockResolvedValue('msg-id-123'),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RunsController],
      providers: [
        { provide: DynamoDBService, useValue: dynamoDbService },
        { provide: SqsService, useValue: sqsService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /run', () => {
    it('returns 202 with run_id when valid requirements submitted', async () => {
      const response = await request(app.getHttpServer())
        .post('/run')
        .send({ requirements: 'Build a REST API for user management' })
        .expect(202);

      expect(response.body.run_id).toBeDefined();
      expect(response.body.status).toBe('pending');
      expect(response.body.poll_url).toContain('/run/');
      expect(dynamoDbService.createRun).toHaveBeenCalled();
      expect(sqsService.sendMessage).toHaveBeenCalled();
    });

    it('returns 400 when requirements are too short', async () => {
      await request(app.getHttpServer())
        .post('/run')
        .send({ requirements: 'short' })
        .expect(400);
    });

    it('returns 400 when requirements are missing', async () => {
      await request(app.getHttpServer()).post('/run').send({}).expect(400);
    });

    it('returns 400 when body contains unknown properties', async () => {
      await request(app.getHttpServer())
        .post('/run')
        .send({ requirements: 'Build a REST API for user management', extra: 'field' })
        .expect(400);
    });
  });

  describe('GET /run/:runId', () => {
    it('returns run status when found', async () => {
      (dynamoDbService.getRun as jest.Mock).mockResolvedValue({
        run_id: 'run-123',
        sk: 'RUN',
        status: 'completed',
        requirements: 'Build an API',
        plan: 'A plan',
        code: 'print("hello")',
        review: {
          qualityScore: 0.85,
          summary: 'Good code',
          issues: [],
          suggestions: [],
          approved: true,
        },
        tests: [],
        test_results: { passed: 5, failed: 0, total: 5, failures: [] },
        quality_score: 0.85,
        revision_count: 1,
        token_usage: { planner: 500, coder: 1000 },
        total_cost_usd: 0.025,
        errors: [],
        last_error: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:01:00Z',
      });

      const response = await request(app.getHttpServer())
        .get('/run/run-123')
        .expect(200);

      expect(response.body.run_id).toBe('run-123');
      expect(response.body.status).toBe('completed');
      expect(response.body.review.quality_score).toBe(0.85);
      expect(response.body.test_results.success_rate).toBe(1);
    });

    it('returns 404 when run not found', async () => {
      (dynamoDbService.getRun as jest.Mock).mockResolvedValue(null);

      await request(app.getHttpServer()).get('/run/nonexistent').expect(404);
    });
  });

  describe('GET /run', () => {
    it('returns list of runs by status', async () => {
      (dynamoDbService.listRunsByStatus as jest.Mock).mockResolvedValue([
        {
          run_id: 'run-1',
          sk: 'RUN',
          status: 'completed',
          requirements: 'Task 1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:01:00Z',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/run?status=completed&limit=10')
        .expect(200);

      expect(response.body.runs).toHaveLength(1);
      expect(response.body.count).toBe(1);
    });

    it('returns empty list when no runs match', async () => {
      (dynamoDbService.listRunsByStatus as jest.Mock).mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/run?status=failed')
        .expect(200);

      expect(response.body.runs).toHaveLength(0);
      expect(response.body.count).toBe(0);
    });
  });
});
