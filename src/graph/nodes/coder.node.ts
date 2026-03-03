import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AgentState } from '../state/agent-state.interface';
import { AppConfigService } from '../../config/config.service';
import { CostService } from '../../utils/cost.service';
import { WithRetry } from '../../utils/retry.decorator';
import { Traced } from '../../observability/tracing.service';

const SYSTEM_PROMPT = `You are an expert Python developer. Given a plan, write clean, production-quality Python code.

Rules:
- Include proper error handling and type hints
- Follow PEP 8 conventions
- Write modular, well-structured code
- Wrap your code in a single \`\`\`python code block`;

const REVISION_PROMPT = `You are an expert Python developer. You previously wrote code that received a review.
Revise the code to address the reviewer's feedback.

Rules:
- Fix all issues identified by the reviewer
- Maintain the existing code structure where possible
- Include proper error handling and type hints
- Wrap your code in a single \`\`\`python code block`;

const logger = new Logger('CoderNode');

@Injectable()
export class CoderNode {
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
      temperature: 0.1,
    });
    this.fallbackLlm = new ChatOpenAI({
      modelName: config.fallbackModel,
      openAIApiKey: config.llmApiKey,
      configuration: { baseURL: config.llmBaseUrl },
      temperature: 0.1,
    });
  }

  /**
   * Extract Python code from a markdown code block.
   */
  static extractCode(text: string): string {
    const match = text.match(/```python\s*\n([\s\S]*?)```/);
    if (match && match[1]) {
      return match[1].trim();
    }
    // Fallback: try generic code block
    const genericMatch = text.match(/```\s*\n([\s\S]*?)```/);
    if (genericMatch && genericMatch[1]) {
      return genericMatch[1].trim();
    }
    // No code block found — return raw text
    return text.trim();
  }

  @WithRetry({ maxAttempts: 3, fallbackAttr: 'fallbackLlm' })
  @Traced('coder')
  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    const isRevision = state.review !== null && state.code !== null;

    let userMessage: string;
    let systemPrompt: string;

    if (isRevision) {
      systemPrompt = REVISION_PROMPT;
      userMessage =
        `## Plan\n${state.plan}\n\n` +
        `## Previous Code\n\`\`\`python\n${state.code}\n\`\`\`\n\n` +
        `## Review Feedback\n${state.review!.summary}\n\n` +
        `### Issues\n${state.review!.issues.map((i) => `- ${i}`).join('\n')}\n\n` +
        `### Suggestions\n${state.review!.suggestions.map((s) => `- ${s}`).join('\n')}`;
      logger.log(`Coder: revision ${state.revisionCount + 1}`);
    } else {
      systemPrompt = SYSTEM_PROMPT;
      userMessage = `## Requirements\n${state.requirements}\n\n## Plan\n${state.plan}`;
      logger.log('Coder: initial code generation');
    }

    const messages = [new SystemMessage(systemPrompt), new HumanMessage(userMessage)];
    const response = await this.llm.invoke(messages);
    const rawText = String(response.content);
    const code = CoderNode.extractCode(rawText);

    const usage = (response.response_metadata?.token_usage as Record<string, number>) ?? {};
    const inputTokens = (usage.prompt_tokens as number) ?? 0;
    const outputTokens = (usage.completion_tokens as number) ?? 0;
    const cost = this.costService.calculateCost(this.config.primaryModel, inputTokens, outputTokens);

    return {
      code,
      revisionCount: (state.revisionCount ?? 0) + 1,
      // Reset review and quality_score so supervisor routes back to reviewer
      review: null,
      qualityScore: null,
      tokenUsage: this.costService.accumulateTokenUsage(
        state.tokenUsage ?? {},
        'coder',
        inputTokens + outputTokens,
      ),
      totalCostUsd: (state.totalCostUsd ?? 0) + cost,
    };
  }
}
