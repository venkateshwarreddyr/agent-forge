import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as appscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import { Construct } from 'constructs';

export interface ComputeStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  albSecurityGroup: ec2.SecurityGroup;
  ecsSecurityGroup: ec2.SecurityGroup;
  queue: sqs.Queue;
  dlq: sqs.Queue;
  table: dynamodb.Table;
}

export class ComputeStack extends cdk.Stack {
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // ECR Repository
    const repo = new ecr.Repository(this, 'OrchestratorRepo', {
      repositoryName: 'multi-agent-orchestrator',
      lifecycleRules: [{ maxImageCount: 10 }],
    });

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'OrchestratorLogs', {
      logGroupName: '/ecs/multi-agent-orchestrator',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // LLM API key from Secrets Manager (OpenAI/xAI compatible)
    const llmSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'LlmApiSecret',
      'orchestrator/llm-api-key',
    );

    // ECS Cluster with Container Insights
    const cluster = new ecs.Cluster(this, 'OrchestratorCluster', {
      clusterName: 'multi-agent-orchestrator',
      vpc: props.vpc,
      containerInsights: true,
    });

    // IAM Task Role
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Permissions
    props.queue.grantConsumeMessages(taskRole);
    props.dlq.grantSendMessages(taskRole);
    props.table.grantReadWriteData(taskRole);
    llmSecret.grantRead(taskRole);
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
        resources: ['*'],
      }),
    );

    // Fargate Task Definition: 1 vCPU, 2GB RAM
    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: 1024,
      memoryLimitMiB: 2048,
      taskRole,
    });

    // App container (main application)
    const appContainer = taskDef.addContainer('App', {
      image: ecs.ContainerImage.fromEcrRepository(repo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: 'app',
      }),
      environment: {
        ORCHESTRATOR_MODE: 'api',
        AWS_REGION: cdk.Stack.of(this).region,
        DYNAMODB_TABLE_NAME: props.table.tableName,
        SQS_QUEUE_URL: props.queue.queueUrl,
        OTLP_ENDPOINT: 'http://localhost:4318',
        SERVICE_NAME: 'multi-agent-orchestrator',
        SERVICE_VERSION: '1.0.0',
        ENVIRONMENT: 'production',
      },
      secrets: {
        LLM_API_KEY: ecs.Secret.fromSecretsManager(llmSecret),
      },
      portMappings: [{ containerPort: 3000 }],
      healthCheck: {
        command: ['CMD-SHELL', 'wget -q --spider http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        startPeriod: cdk.Duration.seconds(60),
        retries: 3,
      },
    });

    // ADOT sidecar (OpenTelemetry Collector → X-Ray)
    taskDef.addContainer('AdotCollector', {
      image: ecs.ContainerImage.fromRegistry(
        'public.ecr.aws/aws-observability/aws-otel-collector:latest',
      ),
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: 'otel',
      }),
      portMappings: [{ containerPort: 4318 }],
      essential: false,
    });

    // ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'OrchestratorALB', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
    });

    // Fargate Service with circuit breaker
    this.service = new ecs.FargateService(this, 'OrchestratorService', {
      serviceName: 'orchestrator-service',
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      securityGroups: [props.ecsSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
    });

    // ALB Target Group
    const listener = alb.addListener('HttpListener', { port: 80 });
    listener.addTargets('EcsTarget', {
      port: 3000,
      targets: [this.service],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        unhealthyThresholdCount: 3,
      },
    });

    // Auto-scaling: queue-depth scaling
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    scaling.scaleOnMetric('QueueDepthScaling', {
      metric: props.queue.metricApproximateNumberOfMessagesVisible(),
      scalingSteps: [
        { upper: 0, change: -1 },
        { lower: 5, change: +1 },
        { lower: 25, change: +3 },
        { lower: 100, change: +5 },
      ],
      cooldown: cdk.Duration.seconds(300),
      adjustmentType: appscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ALBDnsName', { value: alb.loadBalancerDnsName });
    new cdk.CfnOutput(this, 'EcrRepoUri', { value: repo.repositoryUri });
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'ServiceName', { value: this.service.serviceName });
  }
}
