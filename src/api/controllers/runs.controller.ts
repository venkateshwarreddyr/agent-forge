import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateRunDto } from '../dto/create-run.dto';
import {
  CreateRunResponse,
  RunStatusResponse,
  ListRunsResponse,
} from '../dto/run-status.response';
import { DynamoDBService } from '../../storage/dynamodb.service';
import { SqsService } from '../../queue/sqs.service';

@Controller('run')
export class RunsController {
  constructor(
    private readonly dynamoDb: DynamoDBService,
    private readonly sqs: SqsService,
  ) {}

  /**
   * POST /run — Submit requirements, enqueue to SQS, return run_id.
   * Returns 202 Accepted (async processing).
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async createRun(@Body() dto: CreateRunDto): Promise<CreateRunResponse> {
    const runId = uuidv4();

    // Create pending run in DynamoDB
    await this.dynamoDb.createRun(runId, dto.requirements);

    // Enqueue job to SQS for worker processing
    await this.sqs.sendMessage({
      run_id: runId,
      requirements: dto.requirements,
    });

    return {
      run_id: runId,
      status: 'pending',
      poll_url: `/run/${runId}`,
    };
  }

  /**
   * GET /run/:runId — Poll run status and partial results.
   */
  @Get(':runId')
  async getRun(@Param('runId') runId: string): Promise<RunStatusResponse> {
    const item = await this.dynamoDb.getRun(runId);
    if (!item) {
      throw new NotFoundException(`Run ${runId} not found`);
    }
    return RunStatusResponse.fromRunItem(item);
  }

  /**
   * GET /run?status=completed&limit=20 — List runs by status using GSI.
   */
  @Get()
  async listRuns(
    @Query('status') status: string = 'completed',
    @Query('limit') limit: number = 20,
  ): Promise<ListRunsResponse> {
    const items = await this.dynamoDb.listRunsByStatus(status, limit);
    return {
      runs: items.map((item) => RunStatusResponse.fromRunItem(item)),
      count: items.length,
    };
  }
}
