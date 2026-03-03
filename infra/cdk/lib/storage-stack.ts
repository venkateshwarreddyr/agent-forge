import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Single-table design: PK=run_id, SK="RUN"
    this.table = new dynamodb.Table(this, 'OrchestratorRuns', {
      tableName: 'orchestrator-runs',
      partitionKey: { name: 'run_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand, no capacity planning
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Never accidentally delete
      pointInTimeRecovery: true, // Restore to any second in last 35 days
      timeToLiveAttribute: 'ttl', // Auto-delete items after 30 days
    });

    // GSI: Query "all running jobs, newest first" without table scan
    this.table.addGlobalSecondaryIndex({
      indexName: 'status-createdAt-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Outputs
    new cdk.CfnOutput(this, 'TableName', { value: this.table.tableName });
    new cdk.CfnOutput(this, 'TableArn', { value: this.table.tableArn });
  }
}
