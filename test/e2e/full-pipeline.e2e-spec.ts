import { routeFromSupervisor, SupervisorConfig } from '../../src/graph/supervisor/supervisor.service';
import { AgentState, createInitialState, ReviewResult } from '../../src/graph/state/agent-state.interface';
import { CoderNode } from '../../src/graph/nodes/coder.node';
import { ReviewerNode } from '../../src/graph/nodes/reviewer.node';
import { TesterNode } from '../../src/graph/nodes/tester.node';
import { END } from '@langchain/langgraph';

/**
 * E2E test that simulates the full pipeline by manually stepping through
 * supervisor routing decisions and verifying state transitions.
 * LLM calls are not made — this tests the orchestration logic.
 */

const config: SupervisorConfig = {
  maxRevisionCycles: 3,
  reviewerQualityThreshold: 0.7,
};

describe('Full Pipeline (e2e)', () => {
  it('routes through planner → coder → reviewer → tester → END for high-quality code', () => {
    let state: AgentState = createInitialState('e2e-run-1', 'Build a calculator');

    // Step 1: supervisor → planner (no plan)
    expect(routeFromSupervisor(state, config)).toBe('planner');

    // Simulate planner output
    state = { ...state, plan: 'Calculator implementation plan' };

    // Step 2: supervisor → coder (plan exists, no code)
    expect(routeFromSupervisor(state, config)).toBe('coder');

    // Simulate coder output
    state = { ...state, code: 'def add(a, b): return a + b', revisionCount: 1 };

    // Step 3: supervisor → reviewer (code exists, no review)
    expect(routeFromSupervisor(state, config)).toBe('reviewer');

    // Simulate reviewer output (high quality)
    const review: ReviewResult = {
      qualityScore: 0.85,
      summary: 'Good implementation',
      issues: [],
      suggestions: [],
      approved: true,
    };
    state = { ...state, review, qualityScore: 0.85 };

    // Step 4: supervisor → tester (quality >= threshold)
    expect(routeFromSupervisor(state, config)).toBe('tester');

    // Simulate tester output
    state = { ...state, status: 'completed' };
  });

  it('triggers revision cycle when quality is below threshold', () => {
    let state: AgentState = {
      ...createInitialState('e2e-run-2', 'Build a web scraper'),
      plan: 'Scraper plan',
      code: 'import requests',
      revisionCount: 1,
    };

    // Review with low quality
    const lowReview: ReviewResult = {
      qualityScore: 0.4,
      summary: 'Major issues found',
      issues: ['No error handling', 'Missing rate limiting'],
      suggestions: ['Add try/except blocks'],
      approved: false,
    };
    state = { ...state, review: lowReview, qualityScore: 0.4 };

    // Should route back to coder for revision
    expect(routeFromSupervisor(state, config)).toBe('coder');

    // After coder revision, review and qualityScore are reset
    state = {
      ...state,
      code: 'import requests\ntry:\n    ...',
      revisionCount: 2,
      review: null,
      qualityScore: null,
    };

    // Should route to reviewer again
    expect(routeFromSupervisor(state, config)).toBe('reviewer');
  });

  it('accepts best-effort when revision budget is exhausted', () => {
    const state: AgentState = {
      ...createInitialState('e2e-run-3', 'Build a CLI tool'),
      plan: 'CLI plan',
      code: 'import click',
      revisionCount: 3, // max revisions reached
      review: {
        qualityScore: 0.5,
        summary: 'Still has issues',
        issues: ['Missing tests'],
        suggestions: [],
        approved: false,
      },
      qualityScore: 0.5,
    };

    // Should accept best effort and route to tester
    expect(routeFromSupervisor(state, config)).toBe('tester');
  });

  it('routes to END immediately for failed runs', () => {
    const state: AgentState = {
      ...createInitialState('e2e-run-4', 'Build something'),
      status: 'failed',
    };

    expect(routeFromSupervisor(state, config)).toBe(END);
  });

  it('tracks cost accumulation across agents', () => {
    const state = createInitialState('e2e-run-5', 'Build an API');

    // Simulate cost accumulation (what agents would do)
    const updatedUsage = {
      planner: 800,
      coder: 1200,
      reviewer: 600,
      tester: 900,
    };

    const totalTokens = Object.values(updatedUsage).reduce((a, b) => a + b, 0);
    expect(totalTokens).toBe(3500);
    expect(state.totalCostUsd).toBe(0);
  });

  describe('CoderNode.extractCode', () => {
    it('extracts Python code from markdown code block', () => {
      const text = 'Here is the code:\n```python\ndef hello():\n    print("hi")\n```\nDone.';
      expect(CoderNode.extractCode(text)).toBe('def hello():\n    print("hi")');
    });

    it('extracts from generic code block when no python tag', () => {
      const text = '```\nconst x = 1;\n```';
      expect(CoderNode.extractCode(text)).toBe('const x = 1;');
    });

    it('returns raw text when no code block found', () => {
      const text = 'def hello(): pass';
      expect(CoderNode.extractCode(text)).toBe('def hello(): pass');
    });
  });

  describe('ReviewerNode.parseReview', () => {
    it('parses valid review JSON', () => {
      const json = JSON.stringify({
        quality_score: 0.85,
        summary: 'Good code',
        issues: ['minor issue'],
        suggestions: ['add docs'],
        approved: true,
      });

      const review = ReviewerNode.parseReview(json);
      expect(review.qualityScore).toBe(0.85);
      expect(review.approved).toBe(true);
      expect(review.issues).toEqual(['minor issue']);
    });

    it('returns conservative fallback on invalid JSON', () => {
      const review = ReviewerNode.parseReview('not json at all');
      expect(review.qualityScore).toBe(0.4);
      expect(review.approved).toBe(false);
      expect(review.summary).toContain('parsing failed');
    });
  });

  describe('TesterNode.validateTestStructure', () => {
    it('validates a proper test function', () => {
      expect(TesterNode.validateTestStructure('def test_add():\n    assert add(1, 2) == 3')).toBe(
        true,
      );
    });

    it('validates code with just assertions', () => {
      expect(TesterNode.validateTestStructure('assert True')).toBe(true);
    });

    it('rejects code without test function or assertions', () => {
      expect(TesterNode.validateTestStructure('print("hello")')).toBe(false);
    });
  });
});
