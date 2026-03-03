import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AgentState, ReviewResult } from '../state/agent-state.interface';
import { AppConfigService } from '../../config/config.service';
import { CostService } from '../../utils/cost.service';
import { WithRetry } from '../../utils/retry.decorator';
import { Traced } from '../../observability/tracing.service';

const SYSTEM_PROMPT = `You are an expert code reviewer. Evaluate the given code against the requirements.

Respond with valid JSON only (no markdown, no code fences):
{
  "quality_score": <float 0.0 to 1.0>,
  "summary": "<one paragraph overall assessment>",
  "issues": ["<issue 1>", "<issue 2>", ...],
  "suggestions": ["<suggestion 1>", ...],
  "approved": <true if quality_score >= 0.7>
}

Scoring guide:
- 0.0–0.4: Major bugs, security vulnerabilities, or missing core functionality
- 0.5–0.6: Significant issues but partially functional
- 0.7–0.8: Good quality, minor issues
- 0.9–1.0: Excellent, production-ready code`;

const logger = new Logger('ReviewerNode');

@Injectable()
export class ReviewerNode {
  public llm: ChatOpenAI;
  public fallbackLlm: ChatOpenAI;

  constructor(
    private readonly config: AppConfigService,
    private readonly costService: CostService,
  ) {
    this.llm = new ChatOpenAI({
      modelName: config.primaryModel,
      openAIApiKey: config.llmApiKey,
      configuration: { baseURL: config.llmBaseUrl },
      temperature: 0.0,
    });
    this.fallbackLlm = new ChatOpenAI({
      modelName: config.fallbackModel,
      openAIApiKey: config.llmApiKey,
      configuration: { baseURL: config.llmBaseUrl },
      temperature: 0.0,
    });
  }

  /**
   * Parse the review JSON from LLM response.
   * Returns a conservative fallback (score 0.4) if parsing fails.
   */
  static parseReview(text: string): ReviewResult {
    try {
      const parsed = JSON.parse(text);
      return {
        qualityScore: Number(parsed.quality_score) || 0,
        summary: String(parsed.summary || ''),
        issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
        approved: Boolean(parsed.approved),
      };
    } catch {
      logger.warn('Failed to parse review JSON, returning conservative fallback');
      return {
        qualityScore: 0.4,
        summary: 'Review parsing failed — conservative score assigned',
        issues: ['Unable to parse reviewer response'],
        suggestions: ['Retry review with clearer code structure'],
        approved: false,
      };
    }
  }

  @WithRetry({ maxAttempts: 3, fallbackAttr: 'fallbackLlm' })
  @Traced('reviewer')
  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    const userMessage =
      `## Requirements\n${state.requirements}\n\n` +
      `## Code to Review\n\`\`\`python\n${state.code}\n\`\`\``;

    const messages = [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(userMessage)];
    const response = await this.llm.invoke(messages);
    const rawText = String(response.content);

    const review = ReviewerNode.parseReview(rawText);

    logger.log(`Review score: ${review.qualityScore}, approved: ${review.approved}`);

    const usage = (response.response_metadata?.token_usage as Record<string, number>) ?? {};
    const inputTokens = (usage.prompt_tokens as number) ?? 0;
    const outputTokens = (usage.completion_tokens as number) ?? 0;
    const cost = this.costService.calculateCost(this.config.primaryModel, inputTokens, outputTokens);

    return {
      review,
      qualityScore: review.qualityScore,
      tokenUsage: this.costService.accumulateTokenUsage(
        state.tokenUsage ?? {},
        'reviewer',
        inputTokens + outputTokens,
      ),
      totalCostUsd: (state.totalCostUsd ?? 0) + cost,
    };
  }
}
