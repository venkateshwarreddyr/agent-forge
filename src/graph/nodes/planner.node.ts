import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AgentState } from '../state/agent-state.interface';
import { AppConfigService } from '../../config/config.service';
import { CostService } from '../../utils/cost.service';
import { WithRetry } from '../../utils/retry.decorator';
import { Traced } from '../../observability/tracing.service';

const SYSTEM_PROMPT = `You are a senior software architect. Given user requirements, produce a structured implementation plan.

Format your response as:

## Summary
One paragraph overview of what will be built.

## Implementation Steps
1. Step one — description
2. Step two — description
...

## Files to Create
- path/to/file.py — purpose

## Key Considerations
- Edge cases, performance concerns, security notes`;

@Injectable()
export class PlannerNode {
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
      temperature: 0.2,
    });
    this.fallbackLlm = new ChatOpenAI({
      modelName: config.fallbackModel,
      openAIApiKey: config.llmApiKey,
      configuration: { baseURL: config.llmBaseUrl },
      temperature: 0.2,
    });
  }

  @WithRetry({ maxAttempts: 3, fallbackAttr: 'fallbackLlm' })
  @Traced('planner')
  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    const messages = [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(state.requirements)];

    const response = await this.llm.invoke(messages);
    const planText = String(response.content);

    const usage = (response.response_metadata?.token_usage as Record<string, number>) ?? {};
    const inputTokens = (usage.prompt_tokens as number) ?? 0;
    const outputTokens = (usage.completion_tokens as number) ?? 0;
    const cost = this.costService.calculateCost(this.config.primaryModel, inputTokens, outputTokens);

    return {
      plan: planText,
      tokenUsage: this.costService.accumulateTokenUsage(
        state.tokenUsage ?? {},
        'planner',
        inputTokens + outputTokens,
      ),
      totalCostUsd: (state.totalCostUsd ?? 0) + cost,
    };
  }
}
