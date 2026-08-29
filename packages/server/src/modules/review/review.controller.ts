import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: AuthenticatedRequest, @Body() createReviewDto: CreateReviewDto) {
    const review = await this.reviewService.create(req.user.id, createReviewDto);
    return {
      statusCode: HttpStatus.CREATED,
      data: review,
    };
  }

  @Get()
  async findAll(@Req() req: AuthenticatedRequest, @Query() query: QueryReviewDto) {
    const result = await this.reviewService.findAll(req.user.id, query);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  @Get(':id')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const review = await this.reviewService.findOne(id, req.user.id);
    return {
      statusCode: HttpStatus.OK,
      data: review,
    };
  }
}
