import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // LLM
  LLM_API_KEY: Joi.string().optional(),
  XAI_API_KEY: Joi.string().optional(),
  OPENAI_API_KEY: Joi.string().optional(),
  LLM_BASE_URL: Joi.string().optional(),
  PRIMARY_MODEL: Joi.string().default('gpt-4o'),
  FALLBACK_MODEL: Joi.string().default('gpt-4o-mini'),

  // AWS
  AWS_REGION: Joi.string().default('us-east-1'),
  SQS_QUEUE_URL: Joi.string().default('http://localhost:4566/000000000000/orchestrator-jobs'),
  DYNAMODB_TABLE_NAME: Joi.string().default('orchestrator-runs'),

  // OpenTelemetry
  OTLP_ENDPOINT: Joi.string().default('http://localhost:4318'),
  SERVICE_NAME: Joi.string().default('multi-agent-orchestrator'),
  SERVICE_VERSION: Joi.string().default('1.0.0'),
  ENVIRONMENT: Joi.string().default('development'),

  // Behaviour
  MAX_REVISION_CYCLES: Joi.number().integer().default(3),
  REVIEWER_QUALITY_THRESHOLD: Joi.number().default(0.7),

  // Runtime
  ORCHESTRATOR_MODE: Joi.string().valid('api', 'worker', 'all').default('api'),
  HOST: Joi.string().default('0.0.0.0'),
  PORT: Joi.number().integer().default(3000),

  // LocalStack
  USE_LOCALSTACK: Joi.boolean().default(false),
  LOCALSTACK_ENDPOINT: Joi.string().default('http://localhost:4566'),
});
