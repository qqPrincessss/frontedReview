import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum ReviewSort {
  CREATED_AT_ASC = 'created_at:asc',
  CREATED_AT_DESC = 'created_at:desc',
  OVERALL_SCORE_ASC = 'overall_score:asc',
  OVERALL_SCORE_DESC = 'overall_score:desc',
}

export class QueryReviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(ReviewSort)
  sort?: ReviewSort = ReviewSort.CREATED_AT_DESC;
}
