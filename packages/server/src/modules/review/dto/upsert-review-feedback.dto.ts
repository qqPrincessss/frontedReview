import { FeedbackRating } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertReviewFeedbackDto {
  @IsEnum(FeedbackRating, { message: 'rating 只能是 UP 或 DOWN' })
  rating: FeedbackRating;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'comment 不能超过 2000 个字符' })
  comment?: string;
}
