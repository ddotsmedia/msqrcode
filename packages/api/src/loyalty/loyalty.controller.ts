import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LoyaltyService } from './loyalty.service';

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

  @Post('admin/loyalty/stamp')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  stamp(@Body() body: Record<string, unknown>) {
    return this.loyalty.addStamp(body);
  }

  @Post('admin/loyalty/redeem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  redeem(@Body() body: Record<string, unknown>) {
    return this.loyalty.redeem(body);
  }
}
