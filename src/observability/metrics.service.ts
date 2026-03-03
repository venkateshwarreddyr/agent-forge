import { Injectable } from '@nestjs/common';

/**
 * CloudWatch Embedded Metric Format (EMF) helpers.
 *
 * Metrics are emitted as JSON-structured log lines to stdout.
 * CloudWatch automatically extracts metrics from the _aws namespace,
 * avoiding PutMetricData API calls entirely.
 */
@Injectable()
export class MetricsService {
  private readonly namespace = 'MultiAgentOrchestrator';
  private readonly environment: string;

  constructor() {
    this.environment = process.env.ENVIRONMENT || 'development';
  }

  emitRunCost(costUsd: number): void {
    this.emitMetric('RunCostUSD', costUsd, 'None');
  }

  emitTokenCount(totalTokens: number): void {
    this.emitMetric('TotalTokens', totalTokens, 'Count');
  }

  emitRunDuration(durationMs: number): void {
    this.emitMetric('RunDurationMs', durationMs, 'Milliseconds');
  }

  emitRevisionCount(count: number): void {
    this.emitMetric('RevisionCycles', count, 'Count');
  }

  private emitMetric(name: string, value: number, unit: string): void {
    const emfLog = {
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: this.namespace,
            Dimensions: [['environment']],
            Metrics: [
              {
                Name: name,
                Unit: unit,
              },
            ],
          },
        ],
      },
      environment: this.environment,
      [name]: value,
    };

    process.stdout.write(JSON.stringify(emfLog) + '\n');
  }
}
