import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';
import { AgentState } from '../state/agent-state.interface';
import { END } from '@langchain/langgraph';

const logger = new Logger('Supervisor');

export interface SupervisorConfig {
  maxRevisionCycles: number;
  reviewerQualityThreshold: number;
}

/**
 * Pure function routing logic for the hub-and-spoke supervisor.
 *
 * No LLM call — deterministic routing based on state inspection.
 * Returns the name of the next node or END.
 */
export function routeFromSupervisor(state: AgentState, config: SupervisorConfig): string {
  // 1. Failed runs go straight to END
  if (state.status === 'failed') {
    logger.log('Routing to END: run has failed');
    return END;
  }

  // 2. No plan yet → planner
  if (state.plan === null || state.plan === undefined) {
    logger.log('Routing to planner: no plan generated yet');
    return 'planner';
  }

  // 3. No code yet → coder
  if (state.code === null || state.code === undefined) {
    logger.log('Routing to coder: no code generated yet');
    return 'coder';
  }

  // 4. No review yet → reviewer
  if (state.review === null || state.review === undefined) {
    logger.log('Routing to reviewer: code not yet reviewed');
    return 'reviewer';
  }

  // 5. Quality score meets threshold → tester
  if (
    state.qualityScore !== null &&
    state.qualityScore !== undefined &&
    state.qualityScore >= config.reviewerQualityThreshold
  ) {
    logger.log(
      `Routing to tester: quality score ${state.qualityScore} >= threshold ${config.reviewerQualityThreshold}`,
    );
    return 'tester';
  }

  // 6. Revision budget remaining → coder (revision cycle)
  if (state.revisionCount < config.maxRevisionCycles) {
    logger.log(
      `Routing to coder: revision ${state.revisionCount + 1}/${config.maxRevisionCycles} ` +
        `(quality ${state.qualityScore} < threshold ${config.reviewerQualityThreshold})`,
    );
    return 'coder';
  }

  // 7. Revision budget exhausted → accept best-effort, route to tester
  logger.warn(
    `Routing to tester: revision budget exhausted (${state.revisionCount}/${config.maxRevisionCycles}), ` +
      `accepting quality score ${state.qualityScore}`,
  );
  return 'tester';
}

@Injectable()
export class SupervisorService {
  private readonly config: SupervisorConfig;

  constructor(appConfig: AppConfigService) {
    this.config = {
      maxRevisionCycles: appConfig.maxRevisionCycles,
      reviewerQualityThreshold: appConfig.reviewerQualityThreshold,
    };
  }

  /**
   * Supervisor node handler — returns a partial state update with currentAgent.
   */
  invoke(state: AgentState): Partial<AgentState> {
    const nextAgent = routeFromSupervisor(state, this.config);
    return {
      currentAgent: nextAgent,
      status: state.status === 'failed' ? 'failed' : 'running',
    };
  }

  /**
   * Routing function for LangGraph conditional edges.
   */
  route(state: AgentState): string {
    return routeFromSupervisor(state, this.config);
  }
}
