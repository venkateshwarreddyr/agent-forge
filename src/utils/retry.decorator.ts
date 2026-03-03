import { Logger } from '@nestjs/common';

const logger = new Logger('WithRetry');

export interface RetryOptions {
  maxAttempts: number;
  baseDelay?: number;
  fallbackAttr?: string;
}

/**
 * Determine if an error is retryable.
 *
 * Retryable: RateLimitError, APIConnectionError, 5xx APIError
 * Non-retryable: InvalidRequestError (bad prompt), AuthenticationError
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const name = error.name || '';
    const message = error.message || '';

    // OpenAI SDK error types
    if (name === 'RateLimitError' || message.includes('429')) return true;
    if (name === 'APIConnectionError' || message.includes('ECONNREFUSED')) return true;
    if (name === 'APIError' || name === 'InternalServerError') {
      // 5xx server errors are retryable
      const statusMatch = message.match(/status[_\s]?code[:\s]*(\d+)/i);
      if (statusMatch && parseInt(statusMatch[1]) >= 500) return true;
      // Generic APIError without status code — retry cautiously
      if (!statusMatch) return true;
    }

    // Non-retryable
    if (name === 'InvalidRequestError' || name === 'BadRequestError') return false;
    if (name === 'AuthenticationError') return false;
  }

  return false;
}

/**
 * Async delay with exponential backoff + jitter.
 */
function delay(attempt: number, baseDelay: number): Promise<void> {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random();
  const totalDelay = exponentialDelay + jitter;
  return new Promise((resolve) => setTimeout(resolve, totalDelay * 1000));
}

/**
 * Custom TypeScript method decorator for retry with fallback LLM.
 *
 * On the last attempt, swaps `this.llm` to `this[fallbackAttr]` (a cheaper model)
 * to keep the run alive even if the primary model is rate-limited.
 * Always restores the primary LLM in the finally block.
 *
 * Usage:
 *   @WithRetry({ maxAttempts: 3, fallbackAttr: 'fallbackLlm' })
 *   async invoke(state: AgentState): Promise<Partial<AgentState>> { ... }
 */
export function WithRetry(opts: RetryOptions) {
  const { maxAttempts, baseDelay = 1.0, fallbackAttr } = opts;

  return function (_target: object, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: Record<string, unknown>, ...args: unknown[]) {
      let lastError: Error | null = null;
      const originalLlm = this.llm;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const isLastAttempt = attempt === maxAttempts - 1;

        // Swap to fallback model on last attempt
        if (isLastAttempt && fallbackAttr && this[fallbackAttr]) {
          logger.warn(
            `${propertyKey}: Swapping to fallback LLM for final attempt ${attempt + 1}/${maxAttempts}`,
          );
          this.llm = this[fallbackAttr];
        }

        try {
          const result = await originalMethod.apply(this, args);
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (!isRetryable(error)) {
            logger.error(
              `${propertyKey}: Non-retryable error on attempt ${attempt + 1}/${maxAttempts}: ${lastError.message}`,
            );
            throw lastError;
          }

          logger.warn(
            `${propertyKey}: Retryable error on attempt ${attempt + 1}/${maxAttempts}: ${lastError.message}`,
          );

          if (!isLastAttempt) {
            await delay(attempt, baseDelay);
          }
        } finally {
          // Always restore the primary LLM
          if (originalLlm !== undefined) {
            this.llm = originalLlm;
          }
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}
