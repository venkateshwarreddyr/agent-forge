import { ReviewResult, TestCase, TestRunResult } from '../../graph/state/agent-state.interface';
import { RunItem } from '../../storage/schemas/run-item.interface';

export class CreateRunResponse {
  run_id!: string;
  status!: string;
  poll_url!: string;
}

export class ReviewSummary {
  quality_score!: number;
  summary!: string;
  approved!: boolean;
}

export class TestResultSummary {
  passed!: number;
  failed!: number;
  total!: number;
  success_rate!: number;
}

export class RunStatusResponse {
  run_id!: string;
  status!: string;
  requirements!: string;
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
  created_at!: string;
  updated_at!: string;

  static fromRunItem(item: RunItem): RunStatusResponse {
    const response = new RunStatusResponse();
    response.run_id = item.run_id;
    response.status = item.status;
    response.requirements = item.requirements;
    response.plan = item.plan;
    response.code = item.code;
    response.quality_score = item.quality_score;
    response.revision_count = item.revision_count;
    response.token_usage = item.token_usage;
    response.total_cost_usd = item.total_cost_usd;
    response.errors = item.errors;
    response.created_at = item.created_at;
    response.updated_at = item.updated_at;

    if (item.review) {
      response.review = {
        quality_score: item.review.qualityScore,
        summary: item.review.summary,
        approved: item.review.approved,
      };
    }

    if (item.tests) {
      response.tests = item.tests;
    }

    if (item.test_results) {
      const tr = item.test_results;
      response.test_results = {
        passed: tr.passed,
        failed: tr.failed,
        total: tr.total,
        success_rate: tr.total > 0 ? tr.passed / tr.total : 0,
      };
    }

    return response;
  }
}

export class ListRunsResponse {
  runs!: RunStatusResponse[];
  count!: number;
}
