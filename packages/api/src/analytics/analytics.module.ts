import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEvent } from '../entities/analytics-event.entity';
import { Branch } from '../entities/branch.entity';
import { AnalyticsService } from './analytics.service';
import { InsightsService } from './insights.service';
import { SalesService } from './sales.service';
import { MenuService } from './menu.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent, Branch])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, InsightsService, SalesService, MenuService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
