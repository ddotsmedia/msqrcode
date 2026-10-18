import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, ForbiddenException, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PromotionsService } from './promotions.service';
import { OfferStatsService } from './offer-stats.service';

type Staff = { role: string; assigned_branch_id?: string | null };

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
  create(@Body() body: Record<string, unknown>, @Req() req: { user: Staff }) {
    // Branch managers can only add offers for their own branch, never site-wide ones.
    if (req.user.role !== 'admin') {
      if (!req.user.assigned_branch_id) throw new ForbiddenException('Your account has no branch');
      body = { ...body, branch_id: req.user.assigned_branch_id };
    }
    return this.promotions.create(body);
  }

  @Patch('admin/promotions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  setActive(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: { user: Staff }) {
    return this.promotions.setActive(id, body, req.user);
  }
}
