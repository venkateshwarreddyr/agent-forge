import { Injectable } from '@nestjs/common';
import { StateGraph, END } from '@langchain/langgraph';
import { AgentStateAnnotation, AgentState } from './state/agent-state.interface';
import { SupervisorService } from './supervisor/supervisor.service';
import { PlannerNode } from './nodes/planner.node';
import { CoderNode } from './nodes/coder.node';
import { ReviewerNode } from './nodes/reviewer.node';
import { TesterNode } from './nodes/tester.node';

@Injectable()
export class GraphService {
  constructor(
    private readonly supervisor: SupervisorService,
    private readonly planner: PlannerNode,
    private readonly coder: CoderNode,
    private readonly reviewer: ReviewerNode,
    private readonly tester: TesterNode,
  ) {}

  /**
   * Build and compile the LangGraph.js agent graph.
   *
   * Topology (hub-and-spoke):
   *   supervisor → (conditional) → planner | coder | reviewer | tester | END
   *   planner → supervisor
   *   coder → supervisor
   *   reviewer → supervisor
   *   tester → END
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildGraph(): any {
    // LangGraph.js StateGraph has strict generic types that don't align well with
    // dynamic node names. Runtime behavior is correct; use type assertions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graph: any = new StateGraph(AgentStateAnnotation);

    // Add nodes
    graph.addNode('supervisor', (state: AgentState) => this.supervisor.invoke(state));
    graph.addNode('planner', (state: AgentState) => this.planner.invoke(state));
    graph.addNode('coder', (state: AgentState) => this.coder.invoke(state));
    graph.addNode('reviewer', (state: AgentState) => this.reviewer.invoke(state));
    graph.addNode('tester', (state: AgentState) => this.tester.invoke(state));

    // Entry point
    graph.setEntryPoint('supervisor');

    // Conditional edges from supervisor based on routing decision
    graph.addConditionalEdges('supervisor', (state: AgentState) => this.supervisor.route(state), {
      planner: 'planner',
      coder: 'coder',
      reviewer: 'reviewer',
      tester: 'tester',
      [END]: END,
    });

    // All agents except tester return to supervisor for next routing decision
    graph.addEdge('planner', 'supervisor');
    graph.addEdge('coder', 'supervisor');
    graph.addEdge('reviewer', 'supervisor');

    // Tester is the terminal node
    graph.addEdge('tester', END);

    return graph.compile();
  }
}
