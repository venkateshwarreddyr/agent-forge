export class HealthResponse {
  status!: 'healthy' | 'unhealthy';
  version!: string;
  environment!: string;
  dynamodb!: boolean;
}

export class MetricsResponse {
  uptime_seconds!: number;
  environment!: string;
  version!: string;
}
