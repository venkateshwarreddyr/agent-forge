import { Injectable, Logger } from '@nestjs/common';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { GraphService } from '../graph/graph.service';
import { DynamoDBService } from '../storage/dynamodb.service';
import { MetricsService } from '../observability/metrics.service';
import { createInitialState } from '../graph/state/agent-state.interface';

@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);

  constructor(
    private readonly graphService: GraphService,
    private readonly dynamoDb: DynamoDBService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Execute the full agent graph for a run.
   *
   * 1. Create root OTel span
   * 2. Update DynamoDB: status="running"
   * 3. Invoke graph with initial state
   * 4. Persist results to DynamoDB
   * 5. Emit CloudWatch EMF metrics
   * 6. On error: update DynamoDB with failure status
   */
  async execute(runId: string, requirements: string): Promise<void> {
    const tracer = trace.getTracer('orchestrator');
    const startTime = Date.now();

    await tracer.startActiveSpan('worker.execute', async (span) => {
      span.setAttribute('run.id', runId);

      try {
        // Update status to running
        await this.dynamoDb.updateRun(runId, { status: 'running' });

        // Build and invoke the graph
        const graph = this.graphService.buildGraph();
        const initialState = createInitialState(runId, requirements);
        const finalState = await graph.invoke(initialState);

        // Persist results
        await this.dynamoDb.updateRun(runId, {
          status: finalState.status,
          plan: finalState.plan,
          code: finalState.code,
          review: finalState.review,
          tests: finalState.tests,
          test_results: finalState.testResults,
          quality_score: finalState.qualityScore,
          revision_count: finalState.revisionCount,
          token_usage: finalState.tokenUsage,
          total_cost_usd: finalState.totalCostUsd,
          errors: finalState.errors,
          last_error: finalState.lastError,
        });

        // Emit metrics
        const durationMs = Date.now() - startTime;
        this.metrics.emitRunDuration(durationMs);
        this.metrics.emitRevisionCount(finalState.revisionCount);
        this.metrics.emitRunCost(finalState.totalCostUsd);

        if (finalState.tokenUsage) {
          const values = Object.values(finalState.tokenUsage) as number[];
          const totalTokens = values.reduce((a, b) => a + b, 0);
          this.metrics.emitTokenCount(totalTokens);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        this.logger.log(
          `Run ${runId} completed in ${durationMs}ms, cost: $${finalState.totalCostUsd.toFixed(4)}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        this.logger.error(`Run ${runId} failed: ${message}`);

        await this.dynamoDb.updateRun(runId, {
          status: 'failed',
          last_error: message,
        });

        throw error;
      } finally {
        span.end();
      }
    });
  }
}
