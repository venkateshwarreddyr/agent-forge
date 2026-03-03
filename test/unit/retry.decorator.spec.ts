import { WithRetry } from '../../src/utils/retry.decorator';

// Mock delay to avoid actual waiting in tests
jest.useFakeTimers();

class MockAgent {
  llm: { invoke: jest.Mock };
  fallbackLlm: { invoke: jest.Mock };
  callCount = 0;

  constructor() {
    this.llm = { invoke: jest.fn() };
    this.fallbackLlm = { invoke: jest.fn() };
  }

  @WithRetry({ maxAttempts: 3, baseDelay: 0.001, fallbackAttr: 'fallbackLlm' })
  async invoke(input: string): Promise<string> {
    this.callCount++;
    const result = await this.llm.invoke(input);
    return result;
  }
}

// Helper: create a rate limit error
function createRateLimitError(): Error {
  const error = new Error('Rate limit exceeded - 429');
  error.name = 'RateLimitError';
  return error;
}

// Helper: create a non-retryable error
function createInvalidRequestError(): Error {
  const error = new Error('Invalid request');
  error.name = 'InvalidRequestError';
  return error;
}

describe('WithRetry decorator', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('success scenarios', () => {
    it('succeeds on first attempt', async () => {
      const agent = new MockAgent();
      agent.llm.invoke.mockResolvedValue('success');

      // Run with real timers for this test (no delays on success)
      jest.useRealTimers();
      const result = await agent.invoke('test');
      jest.useFakeTimers();

      expect(result).toBe('success');
      expect(agent.llm.invoke).toHaveBeenCalledTimes(1);
    });

    it('restores primary LLM after successful call', async () => {
      const agent = new MockAgent();
      const originalLlm = agent.llm;
      agent.llm.invoke.mockResolvedValue('success');

      jest.useRealTimers();
      await agent.invoke('test');
      jest.useFakeTimers();

      expect(agent.llm).toBe(originalLlm);
    });
  });

  describe('retry on rate limit', () => {
    it('retries on rate limit and succeeds on third attempt', async () => {
      const agent = new MockAgent();
      agent.llm.invoke
        .mockRejectedValueOnce(createRateLimitError())
        .mockRejectedValueOnce(createRateLimitError())
        .mockResolvedValue('success');

      // The fallback LLM should be used on the last attempt
      agent.fallbackLlm.invoke.mockResolvedValue('fallback-success');

      jest.useRealTimers();
      const result = await agent.invoke('test');
      jest.useFakeTimers();

      // On the 3rd attempt (last), the LLM is swapped to fallback
      // so fallbackLlm.invoke should be called (via agent.llm which was swapped)
      expect(result).toBe('fallback-success');
    });

    it('throws after all retry attempts are exhausted', async () => {
      const agent = new MockAgent();
      agent.llm.invoke.mockRejectedValue(createRateLimitError());
      agent.fallbackLlm.invoke.mockRejectedValue(createRateLimitError());

      jest.useRealTimers();
      await expect(agent.invoke('test')).rejects.toThrow('Rate limit exceeded');
      jest.useFakeTimers();
    });
  });

  describe('non-retryable errors', () => {
    it('throws immediately on non-retryable error', async () => {
      const agent = new MockAgent();
      agent.llm.invoke.mockRejectedValue(createInvalidRequestError());

      jest.useRealTimers();
      await expect(agent.invoke('test')).rejects.toThrow('Invalid request');
      jest.useFakeTimers();

      expect(agent.llm.invoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('fallback model', () => {
    it('swaps to fallback LLM on the last attempt', async () => {
      const agent = new MockAgent();
      const originalLlm = agent.llm;

      agent.llm.invoke
        .mockRejectedValueOnce(createRateLimitError())
        .mockRejectedValueOnce(createRateLimitError());

      agent.fallbackLlm.invoke.mockResolvedValue('fallback-result');

      jest.useRealTimers();
      const result = await agent.invoke('test');
      jest.useFakeTimers();

      expect(result).toBe('fallback-result');
      // After call, primary LLM should be restored
      expect(agent.llm).toBe(originalLlm);
    });
  });
});
