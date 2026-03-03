#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { QueueStack } from '../lib/queue-stack';
import { StorageStack } from '../lib/storage-stack';
import { ComputeStack } from '../lib/compute-stack';
import { ObservabilityStack } from '../lib/observability-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const network = new NetworkStack(app, 'NetworkStack', { env });
const queue = new QueueStack(app, 'QueueStack', { env });
const storage = new StorageStack(app, 'StorageStack', { env });

const compute = new ComputeStack(app, 'ComputeStack', {
  env,
  vpc: network.vpc,
  albSecurityGroup: network.albSecurityGroup,
  ecsSecurityGroup: network.ecsSecurityGroup,
  queue: queue.queue,
  dlq: queue.dlq,
  table: storage.table,
});
compute.addDependency(network);
compute.addDependency(queue);
compute.addDependency(storage);

const observability = new ObservabilityStack(app, 'ObservabilityStack', {
  env,
  ecsService: compute.service,
  dlq: queue.dlq,
});
observability.addDependency(compute);

app.synth();
