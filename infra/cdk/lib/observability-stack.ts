import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface ObservabilityStackProps extends cdk.StackProps {
  ecsService: ecs.FargateService;
  dlq: sqs.Queue;
}

export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const namespace = 'MultiAgentOrchestrator';

    // ── CloudWatch Dashboard ──────────────────────────────────────────────
    const dashboard = new cloudwatch.Dashboard(this, 'OrchestratorDashboard', {
      dashboardName: 'multi-agent-orchestrator',
    });

    // Run cost metric (from EMF)
    const runCostMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'RunCostUSD',
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
      dimensionsMap: { environment: 'production' },
    });

    // Run duration metric (from EMF)
    const runDurationMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'RunDurationMs',
      statistic: 'p99',
      period: cdk.Duration.minutes(5),
      dimensionsMap: { environment: 'production' },
    });

    // Revision cycles metric (from EMF)
    const revisionMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'RevisionCycles',
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
      dimensionsMap: { environment: 'production' },
    });

    // ECS CPU and Memory
    const cpuMetric = props.ecsService.metricCpuUtilization();
    const memMetric = props.ecsService.metricMemoryUtilization();

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Run Cost (USD)',
        left: [runCostMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Run Duration (P99 ms)',
        left: [runDurationMetric],
        width: 12,
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Revision Cycles',
        left: [revisionMetric],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS CPU Utilization',
        left: [cpuMetric],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS Memory Utilization',
        left: [memMetric],
        width: 8,
      }),
    );

    // DLQ depth widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DLQ Messages',
        left: [props.dlq.metricApproximateNumberOfMessagesVisible()],
        width: 12,
      }),
    );

    // ── Alarms ────────────────────────────────────────────────────────────

    // High error rate alarm
    new cloudwatch.Alarm(this, 'HighErrorRate', {
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'RunDurationMs',
        statistic: 'SampleCount',
        period: cdk.Duration.minutes(5),
        dimensionsMap: { environment: 'production' },
      }),
      threshold: 0,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'No runs completing — possible system failure',
    });

    // High latency alarm (P99 > 5 minutes)
    new cloudwatch.Alarm(this, 'HighLatency', {
      metric: runDurationMetric,
      threshold: 300000, // 5 minutes in ms
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Run latency P99 exceeds 5 minutes',
    });

    // High CPU alarm
    new cloudwatch.Alarm(this, 'HighCPU', {
      metric: cpuMetric,
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'ECS CPU utilization above 80%',
    });
  }
}
