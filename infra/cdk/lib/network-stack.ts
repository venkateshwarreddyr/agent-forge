import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly ecsSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC with 2 AZs for high availability
    this.vpc = new ec2.Vpc(this, 'OrchestratorVpc', {
      maxAzs: 2,
      natGateways: 1, // Single NAT GW for cost (outbound: OpenAI API, ECR pull)
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // ALB Security Group: HTTPS (443) + HTTP (80) from anywhere
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSG', {
      vpc: this.vpc,
      description: 'ALB security group',
      allowAllOutbound: true,
    });
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');

    // ECS Security Group: Port 3000 from ALB only, all outbound
    this.ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSG', {
      vpc: this.vpc,
      description: 'ECS tasks security group',
      allowAllOutbound: true,
    });
    this.ecsSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(3000),
      'From ALB only',
    );

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId });
  }
}
