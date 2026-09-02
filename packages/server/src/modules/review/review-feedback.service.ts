import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReviewFeedback } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UpsertReviewFeedbackDto } from './dto/upsert-review-feedback.dto';

@Injectable()
export class ReviewFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    reviewId: string,
    userId: string,
    dto: UpsertReviewFeedbackDto,
  ) {
    await this.assertReviewOwner(reviewId, userId);
    const feedback = await this.prisma.reviewFeedback.upsert({
      where: {
        reviewId_userId: { reviewId, userId },
      },
      create: {
        reviewId,
        userId,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      },
      update: {
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      },
    });

    return this.toResponse(feedback);
  }

  async findOne(reviewId: string, userId: string) {
    await this.assertReviewOwner(reviewId, userId);
    const feedback = await this.prisma.reviewFeedback.findUnique({
      where: {
        reviewId_userId: { reviewId, userId },
      },
    });

    return feedback ? this.toResponse(feedback) : null;
  }

  async remove(reviewId: string, userId: string) {
    await this.assertReviewOwner(reviewId, userId);
    const result = await this.prisma.reviewFeedback.deleteMany({
      where: { reviewId, userId },
    });

    return {
      review_id: reviewId,
      deleted: result.count > 0,
    };
  }

  private async assertReviewOwner(
    reviewId: string,
    userId: string,
  ): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { userId: true },
    });

    if (!review) throw new NotFoundException('审查记录不存在');
    if (review.userId !== userId) {
      throw new ForbiddenException('无权访问此审查记录');
    }
  }

  private toResponse(feedback: ReviewFeedback) {
    return {
      id: feedback.id,
      review_id: feedback.reviewId,
      rating: feedback.rating.toLowerCase() as 'up' | 'down',
      comment: feedback.comment,
      created_at: feedback.createdAt,
      updated_at: feedback.updatedAt,
    };
  }
}
