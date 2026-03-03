import { ReviewResult, TestCase, TestRunResult } from '../../graph/state/agent-state.interface';

/**
 * Shape of a run item as stored in DynamoDB.
 * Single-table design: PK=run_id, SK="RUN".
 */
export interface RunItem {
  run_id: string;
  sk: string; // Always "RUN"
  status: 'pending' | 'running' | 'completed' | 'failed';
  requirements: string;
  plan?: string | null;
  code?: string | null;
  review?: ReviewResult | null;
  tests?: TestCase[];
  test_results?: TestRunResult | null;
  quality_score?: number | null;
  revision_count?: number;
  token_usage?: Record<string, number>;
  total_cost_usd?: number;
  errors?: string[];
  last_error?: string | null;
  created_at: string; // ISO-8601
  updated_at: string; // ISO-8601
  ttl?: number; // Unix epoch seconds for DynamoDB TTL
}

/**
 * Convert a RunItem to DynamoDB attribute map.
 * AWS SDK v3 DocumentClient handles marshalling automatically,
 * so this is mostly a convenience for ensuring the sk and ttl.
 */
export function toDynamoItem(item: RunItem): Record<string, unknown> {
  return {
    ...item,
    sk: 'RUN',
    ttl: item.ttl || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
  };
}

/**
 * Parse a DynamoDB item back into a RunItem.
 */
export function fromDynamoItem(item: Record<string, unknown>): RunItem {
  return {
    run_id: item.run_id as string,
    sk: item.sk as string,
    status: item.status as RunItem['status'],
    requirements: item.requirements as string,
    plan: (item.plan as string) ?? null,
    code: (item.code as string) ?? null,
    review: (item.review as ReviewResult) ?? null,
    tests: (item.tests as TestCase[]) ?? [],
    test_results: (item.test_results as TestRunResult) ?? null,
    quality_score: (item.quality_score as number) ?? null,
    revision_count: (item.revision_count as number) ?? 0,
    token_usage: (item.token_usage as Record<string, number>) ?? {},
    total_cost_usd: (item.total_cost_usd as number) ?? 0,
    errors: (item.errors as string[]) ?? [],
    last_error: (item.last_error as string) ?? null,
    created_at: item.created_at as string,
    updated_at: item.updated_at as string,
    ttl: item.ttl as number,
  };
}
