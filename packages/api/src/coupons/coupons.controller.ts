import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CouponStaff, CouponsService } from './coupons.service';

@Controller()
export class CouponsController {
  constructor(private coupons: CouponsService) {}

  @Post('coupons/issue')
  issue(@Body() body: { promotion_id?: unknown; token?: unknown }) {
    return this.coupons.issue(body);
  }

  @Get('coupons/used')
  used(@Query('token') token?: string) {
    return this.coupons.used(token);
  }

  @Post('admin/coupons/redeem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  redeem(@Body() body: { code?: unknown; branch_id?: unknown }, @Req() req: { user: CouponStaff }) {
    return this.coupons.redeem(body, req.user);
  }
}
