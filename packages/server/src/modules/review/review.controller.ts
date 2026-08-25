import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: any, @Body() createReviewDto: CreateReviewDto) {
    const review = await this.reviewService.create(req.user.id, createReviewDto);
    return {
      statusCode: HttpStatus.CREATED,
      data: review,
    };
  }

  @Get()
  async findAll(@Request() req: any, @Query() query: QueryReviewDto) {
    const result = await this.reviewService.findAll(req.user.id, query);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    const review = await this.reviewService.findOne(id, req.user.id);
    return {
      statusCode: HttpStatus.OK,
      data: review,
    };
  }
}
