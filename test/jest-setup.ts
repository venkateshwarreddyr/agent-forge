// Global test setup — set environment variables before any test module loads
process.env.LLM_API_KEY = 'sk-test-key';
process.env.PRIMARY_MODEL = 'gpt-4o';
process.env.FALLBACK_MODEL = 'gpt-4o-mini';
process.env.AWS_REGION = 'us-east-1';
process.env.SQS_QUEUE_URL = 'http://localhost:4566/000000000000/orchestrator-jobs';
process.env.DYNAMODB_TABLE_NAME = 'orchestrator-runs';
process.env.OTLP_ENDPOINT = 'http://localhost:4318';
process.env.SERVICE_NAME = 'multi-agent-orchestrator';
process.env.SERVICE_VERSION = '1.0.0';
process.env.ENVIRONMENT = 'test';
process.env.MAX_REVISION_CYCLES = '3';
process.env.REVIEWER_QUALITY_THRESHOLD = '0.7';
process.env.ORCHESTRATOR_MODE = 'api';
process.env.HOST = '0.0.0.0';
process.env.PORT = '3000';
process.env.USE_LOCALSTACK = 'true';
process.env.LOCALSTACK_ENDPOINT = 'http://localhost:4566';
