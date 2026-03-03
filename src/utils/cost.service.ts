import { Injectable } from '@nestjs/common';

/**
 * Cost per 1K tokens by model, matching OpenAI pricing.
 */
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
};

@Injectable()
export class CostService {
  /**
   * Calculate the cost in USD for a given model and token usage.
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = COST_PER_1K[model];
    if (!pricing) {
      return 0;
    }
    return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
  }

  /**
   * Accumulate token usage for a specific agent into the running total.
   * Returns a new token usage map (does not mutate the input).
   */
  accumulateTokenUsage(
    current: Record<string, number>,
    agentName: string,
    tokens: number,
  ): Record<string, number> {
    return {
      ...current,
      [agentName]: (current[agentName] || 0) + tokens,
    };
  }
}
