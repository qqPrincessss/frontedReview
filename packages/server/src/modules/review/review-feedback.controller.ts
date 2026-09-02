import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { UpsertReviewFeedbackDto } from './dto/upsert-review-feedback.dto';
import { ReviewFeedbackService } from './review-feedback.service';

@Controller('reviews/:reviewId/feedback')
@UseGuards(JwtAuthGuard)
export class ReviewFeedbackController {
  constructor(
    private readonly reviewFeedbackService: ReviewFeedbackService,
  ) {}

  @Put()
  @HttpCode(HttpStatus.OK)
  async upsert(
    @Req() req: AuthenticatedRequest,
    @Param('reviewId', new ParseUUIDPipe({ version: '4' })) reviewId: string,
    @Body() dto: UpsertReviewFeedbackDto,
  ) {
    const feedback = await this.reviewFeedbackService.upsert(
      reviewId,
      req.user.id,
      dto,
    );

    return {
      statusCode: HttpStatus.OK,
      data: feedback,
    };
  }

  @Get()
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('reviewId', new ParseUUIDPipe({ version: '4' })) reviewId: string,
  ) {
    const feedback = await this.reviewFeedbackService.findOne(
      reviewId,
      req.user.id,
    );

    return {
      statusCode: HttpStatus.OK,
      data: feedback,
    };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('reviewId', new ParseUUIDPipe({ version: '4' })) reviewId: string,
  ) {
    const result = await this.reviewFeedbackService.remove(
      reviewId,
      req.user.id,
    );

    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }
}
