import { Controller, Get } from '@nestjs/common';
import { HealthResponse, MetricsResponse } from '../dto/health.response';
import { DynamoDBService } from '../../storage/dynamodb.service';
import { AppConfigService } from '../../config/config.service';

const startTime = Date.now();

@Controller()
export class HealthController {
  constructor(
    private readonly dynamoDb: DynamoDBService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * GET /health — ECS health check, verifies DynamoDB connectivity.
   */
  @Get('health')
  async getHealth(): Promise<HealthResponse> {
    const dynamoOk = await this.dynamoDb.healthCheck();

    return {
      status: dynamoOk ? 'healthy' : 'unhealthy',
      version: this.config.serviceVersion,
      environment: this.config.environment,
      dynamodb: dynamoOk,
    };
  }

  /**
   * GET /metrics — JSON operational metrics (uptime, run counts).
   */
  @Get('metrics')
  getMetrics(): MetricsResponse {
    return {
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      environment: this.config.environment,
      version: this.config.serviceVersion,
    };
  }
}
