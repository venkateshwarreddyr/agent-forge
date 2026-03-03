import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  // LLM
  get llmApiKey(): string {
    return (
      this.configService.get<string>('LLM_API_KEY') ||
      this.configService.get<string>('XAI_API_KEY') ||
      this.configService.get<string>('OPENAI_API_KEY') ||
      'sk-placeholder'
    );
  }

  get llmBaseUrl(): string {
    const explicitBaseUrl = this.configService.get<string>('LLM_BASE_URL');
    if (explicitBaseUrl) return explicitBaseUrl;

    // If xAI key is present, default to xAI-compatible OpenAI endpoint.
    if (this.configService.get<string>('XAI_API_KEY')) {
      return 'https://api.x.ai/v1';
    }

    return 'https://api.openai.com/v1';
  }

  get primaryModel(): string {
    return this.configService.get<string>('PRIMARY_MODEL')!;
  }

  get fallbackModel(): string {
    return this.configService.get<string>('FALLBACK_MODEL')!;
  }

  // AWS
  get awsRegion(): string {
    return this.configService.get<string>('AWS_REGION')!;
  }

  get sqsQueueUrl(): string {
    return this.configService.get<string>('SQS_QUEUE_URL')!;
  }

  get dynamodbTableName(): string {
    return this.configService.get<string>('DYNAMODB_TABLE_NAME')!;
  }

  // OpenTelemetry
  get otlpEndpoint(): string {
    return this.configService.get<string>('OTLP_ENDPOINT')!;
  }

  get serviceName(): string {
    return this.configService.get<string>('SERVICE_NAME')!;
  }

  get serviceVersion(): string {
    return this.configService.get<string>('SERVICE_VERSION')!;
  }

  get environment(): string {
    return this.configService.get<string>('ENVIRONMENT')!;
  }

  // Behaviour
  get maxRevisionCycles(): number {
    return this.configService.get<number>('MAX_REVISION_CYCLES')!;
  }

  get reviewerQualityThreshold(): number {
    return this.configService.get<number>('REVIEWER_QUALITY_THRESHOLD')!;
  }

  // Runtime
  get orchestratorMode(): 'api' | 'worker' | 'all' {
    return this.configService.get<'api' | 'worker' | 'all'>('ORCHESTRATOR_MODE')!;
  }

  get host(): string {
    return this.configService.get<string>('HOST')!;
  }

  get port(): number {
    return this.configService.get<number>('PORT')!;
  }

  // LocalStack
  get useLocalstack(): boolean {
    return this.configService.get<boolean>('USE_LOCALSTACK')!;
  }

  get localstackEndpoint(): string {
    return this.configService.get<string>('LOCALSTACK_ENDPOINT')!;
  }
}
