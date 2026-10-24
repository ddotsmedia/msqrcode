import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { InsightsService } from './insights.service';
import { SalesService } from './sales.service';
import { MenuService } from './menu.service';
import { AnalyticsEvent } from '../entities/analytics-event.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private analyticsService: AnalyticsService,
    private insightsService: InsightsService,
    private salesService: SalesService,
    private menuService: MenuService,
  ) {}

  // Admin Insights page: KPIs, trends, busy hours, top items, loyalty and feedback.
  @Get('insights')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  insights(@Query('days') days?: string, @Query('branch_id') branchId?: string) {
    return this.insightsService.insights(days, branchId);
  }

  // Admin Sales tab: revenue, order counts, daily trend, per-branch and per-type splits.
  @Get('sales')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  sales(@Query('days') days?: string, @Query('branch_id') branchId?: string) {
    return this.salesService.sales(days, branchId);
  }

  // Admin Menu tab: units and revenue per item, category mix, top and bottom sellers.
  @Get('menu')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  menu(@Query('days') days?: string, @Query('branch_id') branchId?: string) {
    return this.menuService.menu(days, branchId);
  }

  @Post('events')
  async logEvent(@Body() eventData: Partial<AnalyticsEvent>): Promise<AnalyticsEvent> {
    return this.analyticsService.logEvent(eventData);
  }

  @Get('views')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getProductStats(@Query('branch_id') branchId?: string): Promise<any[]> {
    return this.analyticsService.getProductViewStats(branchId);
  }

  @Get('searches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getSearchStats(@Query('branch_id') branchId?: string): Promise<any[]> {
    return this.analyticsService.getSearchStats(branchId);
  }

  @Get('feedback')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
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
