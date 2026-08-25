import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AgentService } from '../../agent/agent.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentService: AgentService,
  ) {}

  async create(userId: string, dto: CreateReviewDto) {
    // 1. 创建 review 记录（状态 PENDING）
    const review = await this.prisma.review.create({
      data: {
        userId,
        diffContent: dto.diff,
        language: dto.language,
        branchFrom: dto.branch_from,
        branchTo: dto.branch_to,
        status: 'PENDING',
      },
    });

    try {
      // 2. 调用 Agent 进行审查
      const result = await this.agentService.reviewDiff(dto.diff, dto.language);

      // 3. 更新 review 记录
      const updatedReview = await this.prisma.review.update({
        where: { id: review.id },
        data: {
          summary: result.summary,
          overallScore: result.overall_score,
          dimensionScores: result.dimension_scores as any,
          highlights: result.highlights as any,
          status: 'COMPLETED',
        },
      });

      // 4. 创建 issues 记录
      if (result.issues && result.issues.length > 0) {
        await this.prisma.reviewIssue.createMany({
          data: result.issues.map((issue) => ({
            reviewId: review.id,
            filePath: issue.file_path,
            lineRange: issue.line_range,
            severity: issue.severity.toUpperCase() as any,
            dimension: issue.dimension,
            what: issue.what,
            why: issue.why,
            suggestion: issue.suggestion,
          })),
        });
      }

      // 5. 返回完整结果
      return this.findOne(review.id, userId);
    } catch (error) {
      // 审查失败，更新状态
      await this.prisma.review.update({
        where: { id: review.id },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  async findAll(userId: string, query: QueryReviewDto) {
    const { page = 1, limit = 10, sort = 'created_at:desc' } = query;
    const skip = (page - 1) * limit;

    // 解析排序
    const [sortField, sortOrder] = sort.split(':');
    const orderBy: any = {};
    orderBy[sortField === 'created_at' ? 'createdAt' : sortField] =
      sortOrder === 'asc' ? 'asc' : 'desc';

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
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { userId } }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        issue_count: item._count.issues,
        _count: undefined,
      })),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, userId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: { issues: true },
    });

    if (!review) {
      throw new NotFoundException('审查记录不存在');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('无权访问此审查记录');
    }

    return review;
  }
}
