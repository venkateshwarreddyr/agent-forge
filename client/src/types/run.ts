export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ReviewSummary {
  quality_score: number;
  summary: string;
  approved: boolean;
}

export interface TestCase {
  name: string;
  description: string;
  inputData: string;
  expectedOutput: string;
  testCode: string;
}

export interface TestResultSummary {
  passed: number;
  failed: number;
  total: number;
  success_rate: number;
}

export interface Run {
  run_id: string;
  status: RunStatus;
  requirements: string;
  plan?: string | null;
  code?: string | null;
  review?: ReviewSummary | null;
  tests?: TestCase[];
  test_results?: TestResultSummary | null;
  quality_score?: number | null;
  revision_count?: number;
  token_usage?: Record<string, number>;
  total_cost_usd?: number;
  errors?: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateRunResponse {
  run_id: string;
  status: string;
  poll_url: string;
}

export interface ListRunsResponse {
  runs: Run[];
  count: number;
}
