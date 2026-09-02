import { Module } from '@nestjs/common';
import { AgentModule } from '../../agent/agent.module';
import { ReviewFeedbackController } from './review-feedback.controller';
import { ReviewFeedbackService } from './review-feedback.service';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [AgentModule],
  controllers: [ReviewController, ReviewFeedbackController],
  providers: [ReviewService, ReviewFeedbackService],
  exports: [ReviewService],
})
export class ReviewModule {}
