import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
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

  // Store rule: customers can delete their rewards card (and everything tied to it) from the app.
  @Post('loyalty/card/:token/delete')
  deleteCard(@Param('token') token: string) {
    return this.loyalty.deleteCard(token);
  }

  // Customers can add their birthday once; it cannot be changed afterwards.
  @Patch('loyalty/card/:token/birthday')
  setBirthday(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.loyalty.setBirthday(token, body);
  }

  @Get('loyalty/settings')
  publicSettings() {
    return this.loyalty.publicSettings();
  }

  // Customer scanned the rotating code on the counter screen.
  @Post('loyalty/self-stamp')
  selfStamp(@Body() body: Record<string, unknown>) {
    return this.loyalty.selfStamp(body);
  }

  @Get('admin/loyalty/counter')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  counter(@Query('branch_id') branchId: string | undefined, @Req() req: StaffReq) {
    return this.loyalty.counter(branchId, req.user);
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
