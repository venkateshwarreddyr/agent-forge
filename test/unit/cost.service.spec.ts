import { CostService } from '../../src/utils/cost.service';

describe('CostService', () => {
  let costService: CostService;

  beforeEach(() => {
    costService = new CostService();
  });

  describe('calculateCost', () => {
    it('calculates cost for gpt-4o input and output tokens', () => {
      const cost = costService.calculateCost('gpt-4o', 1000, 1000);
      // input: 1000/1000 * 0.0025 = 0.0025
      // output: 1000/1000 * 0.010 = 0.010
      expect(cost).toBeCloseTo(0.0125, 6);
    });

    it('calculates cost for gpt-4o-mini', () => {
      const cost = costService.calculateCost('gpt-4o-mini', 1000, 1000);
      // input: 1000/1000 * 0.00015 = 0.00015
      // output: 1000/1000 * 0.0006 = 0.0006
      expect(cost).toBeCloseTo(0.00075, 6);
    });

    it('returns 0 for unknown model', () => {
      const cost = costService.calculateCost('unknown-model', 1000, 1000);
      expect(cost).toBe(0);
    });

    it('handles zero tokens', () => {
      const cost = costService.calculateCost('gpt-4o', 0, 0);
      expect(cost).toBe(0);
    });

    it('handles only input tokens', () => {
      const cost = costService.calculateCost('gpt-4o', 2000, 0);
      // 2000/1000 * 0.0025 = 0.005
      expect(cost).toBeCloseTo(0.005, 6);
    });

    it('handles only output tokens', () => {
      const cost = costService.calculateCost('gpt-4o', 0, 500);
      // 500/1000 * 0.010 = 0.005
      expect(cost).toBeCloseTo(0.005, 6);
    });

    it('handles large token counts', () => {
      const cost = costService.calculateCost('gpt-4o', 100000, 50000);
      // input: 100000/1000 * 0.0025 = 0.25
      // output: 50000/1000 * 0.010 = 0.50
      expect(cost).toBeCloseTo(0.75, 6);
    });
  });

  describe('accumulateTokenUsage', () => {
    it('adds tokens for a new agent', () => {
      const result = costService.accumulateTokenUsage({}, 'planner', 500);
      expect(result).toEqual({ planner: 500 });
    });

    it('accumulates tokens for an existing agent', () => {
      const current = { planner: 500 };
      const result = costService.accumulateTokenUsage(current, 'planner', 300);
      expect(result).toEqual({ planner: 800 });
    });

    it('preserves other agents when adding new one', () => {
      const current = { planner: 500 };
      const result = costService.accumulateTokenUsage(current, 'coder', 1000);
      expect(result).toEqual({ planner: 500, coder: 1000 });
    });

    it('does not mutate the input object', () => {
      const current = { planner: 500 };
      costService.accumulateTokenUsage(current, 'coder', 1000);
      expect(current).toEqual({ planner: 500 });
    });
  });
});
