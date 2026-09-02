import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Severity } from '@prisma/client';
import {
  AgentExecutionOutcome,
  AgentService,
} from '../../agent/agent.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto, ReviewSort } from './dto/query-review.dto';
import { toReviewDetail, toReviewListItem } from './review.mapper';

type SuccessfulAgentOutcome = Extract<AgentExecutionOutcome, { ok: true }>;
type FailedAgentOutcome = Extract<AgentExecutionOutcome, { ok: false }>;

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentService: AgentService,
  ) {}

  async create(userId: string, dto: CreateReviewDto) {
    const preparedCall = this.agentService.prepareReviewDiff(
      dto.diff,
      dto.language,
    );
    const startedAt = new Date();
    const { review, run } = await this.prisma.$transaction(
      async (transaction) => {
        const createdReview = await transaction.review.create({
          data: {
            userId,
            diffContent: dto.diff,
            language: dto.language,
            branchFrom: dto.branch_from,
            branchTo: dto.branch_to,
            status: 'RUNNING',
            startedAt,
          },
        });
        const createdRun = await transaction.reviewRun.create({
          data: {
            reviewId: createdReview.id,
            attemptNo: 1,
            provider: preparedCall.descriptor.provider,
            model: preparedCall.descriptor.model,
            promptVersion: preparedCall.descriptor.promptVersion,
            parameters:
              preparedCall.descriptor.parameters as Prisma.InputJsonValue,
            status: 'RUNNING',
            startedAt,
          },
        });

        return { review: createdReview, run: createdRun };
      },
    );

    const outcome = await preparedCall.execute();
    if (!outcome.ok) {
      await this.markExecutionFailed(review.id, run.id, outcome);
      throw outcome.error;
    }

    try {
      await this.completeReview(review.id, run.id, outcome);
    } catch (error: unknown) {
      await this.markPersistenceFailed(review.id, run.id, outcome, error);
      throw error;
    }

    return this.findOne(review.id, userId);
  }

  async findAll(userId: string, query: QueryReviewDto) {
    const { page = 1, limit = 10, sort = ReviewSort.CREATED_AT_DESC } = query;
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId },
        select: {
          id: true,
          summary: true,
          overallScore: true,
          language: true,
          branchFrom: true,
          branchTo: true,
          status: true,
          createdAt: true,
          _count: { select: { issues: true } },
        },
        orderBy: this.getOrderBy(sort),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where: { userId } }),
    ]);

    return {
      items: items.map(toReviewListItem),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, userId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: { issues: { orderBy: { ordinal: 'asc' } } },
    });

    if (!review) throw new NotFoundException('审查记录不存在');
    if (review.userId !== userId) {
      throw new ForbiddenException('无权访问此审查记录');
    }

    return toReviewDetail(review);
  }

  private async completeReview(
    reviewId: string,
    runId: string,
    outcome: SuccessfulAgentOutcome,
  ): Promise<void> {
    const finishedAt = new Date();
    const { result, metrics } = outcome;

    await this.prisma.$transaction(async (transaction) => {
      await transaction.review.update({
        where: { id: reviewId },
        data: {
          summary: result.summary,
          overallScore: result.overall_score,
          dimensionScores:
            result.dimension_scores as unknown as Prisma.InputJsonValue,
          highlights: result.highlights as Prisma.InputJsonValue,
          status: 'COMPLETED',
          completedAt: finishedAt,
          failedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      });

      if (result.issues.length > 0) {
        await transaction.reviewIssue.createMany({
          data: result.issues.map((issue, index) => ({
            reviewId,
            ordinal: index + 1,
            filePath: issue.file_path,
            lineRange: issue.line_range || null,
            severity: issue.severity.toUpperCase() as Severity,
            dimension: issue.dimension,
            what: issue.what,
            why: issue.why,
            suggestion: issue.suggestion,
          })),
        });
      }

      await transaction.reviewRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          parseStatus: outcome.parseStatus,
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
          latencyMs: metrics.latencyMs,
          finishedAt,
          errorCode: null,
          errorMessage: null,
        },
      });
    });
  }

  private async markExecutionFailed(
    reviewId: string,
    runId: string,
    outcome: FailedAgentOutcome,
  ): Promise<void> {
    const errorCode =
      outcome.stage === 'MODEL'
        ? 'MODEL_REQUEST_FAILED'
        : 'MODEL_RESPONSE_PARSE_FAILED';

    await this.persistFailure(
      reviewId,
      runId,
      errorCode,
      outcome.error,
      outcome.parseStatus,
      outcome.metrics,
    );
  }

  private async markPersistenceFailed(
    reviewId: string,
    runId: string,
    outcome: SuccessfulAgentOutcome,
    cause: unknown,
  ): Promise<void> {
    await this.persistFailure(
      reviewId,
      runId,
      'RESULT_PERSISTENCE_FAILED',
      cause,
      outcome.parseStatus,
      outcome.metrics,
    );
  }

  private async persistFailure(
    reviewId: string,
    runId: string,
    errorCode: string,
    cause: unknown,
    parseStatus: 'SUCCEEDED' | 'FAILED' | null,
    metrics: {
      readonly latencyMs: number;
      readonly inputTokens?: number;
      readonly outputTokens?: number;
    },
  ): Promise<void> {
    try {
      const finishedAt = new Date();
      const errorMessage =
        cause instanceof Error ? cause.message : String(cause);

      await this.prisma.$transaction([
        this.prisma.review.update({
          where: { id: reviewId },
          data: {
            status: 'FAILED',
            completedAt: null,
            failedAt: finishedAt,
            errorCode,
            errorMessage,
          },
        }),
        this.prisma.reviewRun.update({
          where: { id: runId },
          data: {
            status: 'FAILED',
            parseStatus,
            inputTokens: metrics.inputTokens,
            outputTokens: metrics.outputTokens,
            latencyMs: metrics.latencyMs,
            finishedAt,
            errorCode,
            errorMessage,
          },
        }),
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`更新审查与运行失败状态时出错：${message}`);
    }
  }

  private getOrderBy(sort: ReviewSort): Prisma.ReviewOrderByWithRelationInput {
    switch (sort) {
      case ReviewSort.CREATED_AT_ASC:
        return { createdAt: 'asc' };
      case ReviewSort.OVERALL_SCORE_ASC:
        return { overallScore: 'asc' };
      case ReviewSort.OVERALL_SCORE_DESC:
        return { overallScore: 'desc' };
      case ReviewSort.CREATED_AT_DESC:
      default:
        return { createdAt: 'desc' };
    }
  }
}
