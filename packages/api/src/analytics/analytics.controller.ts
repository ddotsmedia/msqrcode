import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent } from '../entities/analytics-event.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Post('events')
  async logEvent(@Body() eventData: Partial<AnalyticsEvent>): Promise<AnalyticsEvent> {
    return this.analyticsService.logEvent(eventData);
  }

  @Get('views')
  async getViewStats(
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ): Promise<any> {
    return this.analyticsService.getViewStats(
      branchId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('products')
  async getProductStats(@Query('branch_id') branchId?: string): Promise<any[]> {
    return this.analyticsService.getProductViewStats(branchId);
  }

  @Get('searches')
  async getSearchStats(@Query('branch_id') branchId?: string): Promise<any[]> {
    return this.analyticsService.getSearchStats(branchId);
  }

  @Get('feedback')
  async getFeedbackStats(@Query('branch_id') branchId?: string): Promise<any[]> {
    return this.analyticsService.getFeedbackStats(branchId);
  }

  @Get('branches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getBranchAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<any> {
    return this.analyticsService.getBranchAnalytics(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
