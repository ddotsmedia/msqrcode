import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LoyaltyService, StaffUser } from './loyalty.service';

type StaffReq = { user: StaffUser };

@Controller()
export class LoyaltyController {
  constructor(private loyalty: LoyaltyService) {}

  @Post('loyalty/enroll')
  enroll(@Body() body: Record<string, unknown>) {
    return this.loyalty.enroll(body);
  }

  @Get('loyalty/card/:token')
  card(@Param('token') token: string) {
    return this.loyalty.getByToken(token);
  }

  @Get('loyalty/settings')
  publicSettings() {
    return this.loyalty.getSettings();
  }

  @Get('admin/loyalty/cards')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  search(@Query('q') q?: string) {
    return this.loyalty.search(q);
  }

  @Get('admin/loyalty/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  history(@Query('phone') phone?: string) {
    return this.loyalty.historyByPhone(phone);
  }

  @Get('admin/loyalty/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  stats() {
    return this.loyalty.stats();
  }

  @Put('admin/loyalty/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.loyalty.updateSettings(body);
  }

  @Post('admin/loyalty/stamp')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  stamp(@Body() body: Record<string, unknown>, @Req() req: StaffReq) {
    return this.loyalty.addStamp(body, req.user);
  }

  @Post('admin/loyalty/redeem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  redeem(@Body() body: Record<string, unknown>, @Req() req: StaffReq) {
    return this.loyalty.redeem(body, req.user);
  }

  @Post('admin/loyalty/adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adjust(@Body() body: Record<string, unknown>, @Req() req: StaffReq) {
    return this.loyalty.adjust(body, req.user);
  }
}
