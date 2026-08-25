import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty({ message: 'diff 内容不能为空' })
  diff: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  branch_from?: string;

  @IsString()
  @IsOptional()
  branch_to?: string;
}
