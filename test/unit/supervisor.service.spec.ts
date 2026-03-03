import { END } from '@langchain/langgraph';
import {
  routeFromSupervisor,
  SupervisorConfig,
} from '../../src/graph/supervisor/supervisor.service';
import { AgentState, createInitialState } from '../../src/graph/state/agent-state.interface';
import { ReviewResult } from '../../src/graph/state/agent-state.interface';

const defaultConfig: SupervisorConfig = {
  maxRevisionCycles: 3,
  reviewerQualityThreshold: 0.7,
};

function makeState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    ...createInitialState('test-run', 'Build a REST API'),
    ...overrides,
  };
}

function makeReview(score: number): ReviewResult {
  return {
    qualityScore: score,
    summary: 'Test review',
    issues: [],
    suggestions: [],
    approved: score >= 0.7,
  };
}

describe('routeFromSupervisor', () => {
  // ── Initial Routing ──────────────────────────────────────────────────

  describe('initial routing', () => {
    it('routes to planner when no plan exists', () => {
      const state = makeState({ plan: null });
      expect(routeFromSupervisor(state, defaultConfig)).toBe('planner');
    });

    it('routes to coder when plan exists but no code', () => {
      const state = makeState({ plan: 'A plan', code: null });
      expect(routeFromSupervisor(state, defaultConfig)).toBe('coder');
    });

    it('routes to reviewer when code exists but no review', () => {
      const state = makeState({ plan: 'A plan', code: 'print("hello")', review: null });
      expect(routeFromSupervisor(state, defaultConfig)).toBe('reviewer');
    });
  });

  // ── Quality Routing ──────────────────────────────────────────────────

  describe('quality routing', () => {
    it('routes to tester when quality score meets threshold', () => {
      const state = makeState({
        plan: 'A plan',
        code: 'print("hello")',
        review: makeReview(0.85),
        qualityScore: 0.85,
      });
      expect(routeFromSupervisor(state, defaultConfig)).toBe('tester');
    });

    it('routes to tester when quality score equals threshold exactly', () => {
      const state = makeState({
        plan: 'A plan',
        code: 'print("hello")',
        review: makeReview(0.7),
        qualityScore: 0.7,
      });
      expect(routeFromSupervisor(state, defaultConfig)).toBe('tester');
    });

    it('routes to coder for revision when quality score is below threshold', () => {
      const state = makeState({
        plan: 'A plan',
        code: 'print("hello")',
        review: makeReview(0.5),
        qualityScore: 0.5,
        revisionCount: 0,
      });
      expect(routeFromSupervisor(state, defaultConfig)).toBe('coder');
    });

    it('routes to coder when score is just below threshold', () => {
      const state = makeState({
        plan: 'A plan',
        code: 'print("hello")',
        review: makeReview(0.69),
        qualityScore: 0.69,
        revisionCount: 1,
      });
      expect(routeFromSupervisor(state, defaultConfig)).toBe('coder');
    });

    it('routes to tester when revision budget is exhausted (low quality, accept best effort)', () => {
      const state = makeState({
        plan: 'A plan',
        code: 'print("hello")',
        review: makeReview(0.3),
        qualityScore: 0.3,
        revisionCount: 3,
      });
      expect(routeFromSupervisor(state, defaultConfig)).toBe('tester');
    });
  });

  // ── Failed Run Routing ───────────────────────────────────────────────

  describe('failed run routing', () => {
    it('routes to END when status is failed', () => {
      const state = makeState({ status: 'failed' });
      expect(routeFromSupervisor(state, defaultConfig)).toBe(END);
    });
  });

  // ── Revision Count Boundary ──────────────────────────────────────────

  describe('revision count boundary', () => {
    it('routes to tester when exactly at max revisions', () => {
      const state = makeState({
        plan: 'A plan',
        code: 'print("hello")',
        review: makeReview(0.5),
        qualityScore: 0.5,
        revisionCount: 3,
      });
      expect(routeFromSupervisor(state, defaultConfig)).toBe('tester');
    });

    it('routes to coder when one below max revisions', () => {
      const state = makeState({
        plan: 'A plan',
        code: 'print("hello")',
        review: makeReview(0.5),
        qualityScore: 0.5,
        revisionCount: 2,
      });
      expect(routeFromSupervisor(state, defaultConfig)).toBe('coder');
    });
  });
});
