import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Severity } from '@prisma/client';
import { AgentService } from '../../agent/agent.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto, ReviewSort } from './dto/query-review.dto';
import { toReviewDetail, toReviewListItem } from './review.mapper';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentService: AgentService,
  ) {}

  async create(userId: string, dto: CreateReviewDto) {
    const review = await this.prisma.review.create({
      data: {
        userId,
        diffContent: dto.diff,
        language: dto.language,
        branchFrom: dto.branch_from,
        branchTo: dto.branch_to,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      const result = await this.agentService.reviewDiff(dto.diff, dto.language);

      await this.prisma.$transaction(async (transaction) => {
        await transaction.review.update({
          where: { id: review.id },
          data: {
            summary: result.summary,
            overallScore: result.overall_score,
            dimensionScores: result.dimension_scores as unknown as Prisma.InputJsonValue,
            highlights: result.highlights as Prisma.InputJsonValue,
            status: 'COMPLETED',
            completedAt: new Date(),
            failedAt: null,
            errorCode: null,
            errorMessage: null,
          },
        });

        if (result.issues.length > 0) {
          await transaction.reviewIssue.createMany({
            data: result.issues.map((issue, index) => ({
              reviewId: review.id,
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
      });

      return this.findOne(review.id, userId);
    } catch (error: unknown) {
      await this.markFailed(review.id, error);
      throw error;
    }
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

  private async markFailed(reviewId: string, cause: unknown): Promise<void> {
    try {
      const errorMessage = cause instanceof Error ? cause.message : String(cause);
      await this.prisma.review.update({
        where: { id: reviewId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`更新审查失败状态时出错：${message}`);
    }
  }
}
