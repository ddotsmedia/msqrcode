import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PromotionsService } from './promotions.service';
import { OfferStatsService } from './offer-stats.service';

@Controller()
export class PromotionsController {
  constructor(
    private promotions: PromotionsService,
    private stats: OfferStatsService,
  ) {}

  @Post('offers/events')
  record(@Body() body: { events?: unknown }) {
    return this.stats.record(body);
  }

  @Get('admin/offers/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  offerStats(@Query('days') days?: string) {
    return this.stats.stats(days);
  }

  @Get('promotions')
  listActive(@Query('branch_id') branchId?: string) {
    return this.promotions.listActive(branchId || undefined);
  }

  @Get('admin/promotions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  listAll(@Query('branch_id') branchId?: string) {
    return this.promotions.listAll(branchId || undefined);
  }

  @Post('admin/promotions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  create(@Body() body: Record<string, unknown>) {
    return this.promotions.create(body);
  }

  @Patch('admin/promotions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  setActive(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.promotions.setActive(id, body);
  }
}
