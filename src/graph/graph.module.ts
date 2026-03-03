import { Module } from '@nestjs/common';
import { GraphService } from './graph.service';
import { SupervisorService } from './supervisor/supervisor.service';
import { PlannerNode } from './nodes/planner.node';
import { CoderNode } from './nodes/coder.node';
import { ReviewerNode } from './nodes/reviewer.node';
import { TesterNode } from './nodes/tester.node';
import { CostService } from '../utils/cost.service';

@Module({
  providers: [
    GraphService,
    SupervisorService,
    PlannerNode,
    CoderNode,
    ReviewerNode,
    TesterNode,
    CostService,
  ],
  exports: [GraphService],
})
export class GraphModule {}
