import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export class QueueStack extends cdk.Stack {
  public readonly queue: sqs.Queue;
  public readonly dlq: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const key = new kms.Key(this, 'QueueKey', {
      enableKeyRotation: true,
      description: 'KMS key for orchestrator SQS queues',
    });

    // Dead Letter Queue: 14-day retention for investigation
    this.dlq = new sqs.Queue(this, 'OrchestratorDLQ', {
      queueName: 'orchestrator-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: key,
    });

    // Main Queue: KMS-encrypted, redrive to DLQ after 3 failures
    this.queue = new sqs.Queue(this, 'OrchestratorJobs', {
      queueName: 'orchestrator-jobs',
      visibilityTimeout: cdk.Duration.seconds(300), // Must exceed max graph runtime (~120s)
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: key,
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount: 3,
      },
    });

    // Alarm: fires when any message lands in DLQ
    new cloudwatch.Alarm(this, 'DlqAlarm', {
      metric: this.dlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Messages in orchestrator DLQ — investigate failed runs',
    });

    // Outputs
    new cdk.CfnOutput(this, 'QueueUrl', { value: this.queue.queueUrl });
    new cdk.CfnOutput(this, 'DlqUrl', { value: this.dlq.queueUrl });
  }
}
