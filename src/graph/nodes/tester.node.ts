import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AgentState, TestCase, TestRunResult } from '../state/agent-state.interface';
import { AppConfigService } from '../../config/config.service';
import { CostService } from '../../utils/cost.service';
import { WithRetry } from '../../utils/retry.decorator';
import { Traced } from '../../observability/tracing.service';

const SYSTEM_PROMPT = `You are an expert test engineer. Generate pytest test cases for the given code.

Respond with valid JSON only (no markdown, no code fences):
[
  {
    "name": "test_function_name",
    "description": "What this test verifies",
    "input_data": "Sample input",
    "expected_output": "Expected result",
    "test_code": "def test_function_name():\\n    assert ..."
  },
  ...
]

Generate at least 5 test cases covering:
- Happy path
- Edge cases
- Error handling
- Boundary values`;

const logger = new Logger('TesterNode');

@Injectable()
export class TesterNode {
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
   * Parse test cases from LLM JSON response.
   */
  static parseTests(text: string): TestCase[] {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((t: Record<string, unknown>) => ({
        name: String(t.name || ''),
        description: String(t.description || ''),
        inputData: String(t.input_data || ''),
        expectedOutput: String(t.expected_output || ''),
        testCode: String(t.test_code || ''),
      }));
    } catch {
      logger.warn('Failed to parse test cases JSON');
      return [];
    }
  }

  /**
   * Structural validation of generated test code.
   * Checks for basic pytest patterns (def test_, assert).
   * This is a lightweight check — no actual execution (sandboxing required for v2).
   */
  static validateTestStructure(testCode: string): boolean {
    const hasTestFunction = /def\s+test_\w+/.test(testCode);
    const hasAssertion = /assert\s/.test(testCode);
    return hasTestFunction || hasAssertion;
  }

  @WithRetry({ maxAttempts: 3, fallbackAttr: 'fallbackLlm' })
  @Traced('tester')
  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    const userMessage =
      `## Requirements\n${state.requirements}\n\n` +
      `## Code to Test\n\`\`\`python\n${state.code}\n\`\`\``;

    const messages = [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(userMessage)];
    const response = await this.llm.invoke(messages);
    const rawText = String(response.content);

    const tests = TesterNode.parseTests(rawText);

    // Validate structure of each test
    let passed = 0;
    let failed = 0;
    const failures: string[] = [];

    for (const test of tests) {
      if (TesterNode.validateTestStructure(test.testCode)) {
        passed++;
      } else {
        failed++;
        failures.push(`${test.name}: Invalid test structure`);
      }
    }

    const testResults: TestRunResult = {
      passed,
      failed,
      total: tests.length,
      failures,
    };

    logger.log(
      `Generated ${tests.length} tests: ${passed} valid, ${failed} invalid`,
    );

    const usage = (response.response_metadata?.token_usage as Record<string, number>) ?? {};
    const inputTokens = (usage.prompt_tokens as number) ?? 0;
    const outputTokens = (usage.completion_tokens as number) ?? 0;
    const cost = this.costService.calculateCost(this.config.primaryModel, inputTokens, outputTokens);

    return {
      tests,
      testResults,
      status: 'completed',
      tokenUsage: this.costService.accumulateTokenUsage(
        state.tokenUsage ?? {},
        'tester',
        inputTokens + outputTokens,
      ),
      totalCostUsd: (state.totalCostUsd ?? 0) + cost,
    };
  }
}
