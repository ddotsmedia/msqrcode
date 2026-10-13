import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchFeedback } from '../entities/branch-feedback.entity';
import { Branch } from '../entities/branch.entity';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [TypeOrmModule.forFeature([BranchFeedback, Branch])],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
