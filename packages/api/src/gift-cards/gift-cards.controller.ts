import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GiftCardsService, GiftStaff } from './gift-cards.service';

@Controller()
export class GiftCardsController {
  constructor(private gifts: GiftCardsService) {}

  @Post('gift-cards/request')
  request(@Body() body: Record<string, unknown>) {
    return this.gifts.request(body);
  }

  @Get('gift-cards/:code')
  get(@Param('code') code: string) {
    return this.gifts.publicGet(code);
  }

  @Get('admin/gift-cards')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  list(@Query('status') status?: string) {
    return this.gifts.list(status);
  }

  @Get('admin/gift-cards/:code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  lookup(@Param('code') code: string) {
    return this.gifts.publicGet(code);
  }

  @Post('admin/gift-cards')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  issue(@Body() body: Record<string, unknown>, @Req() req: { user: GiftStaff }) {
    return this.gifts.issue(body, req.user);
  }

  @Post('admin/gift-cards/:code/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  activate(@Param('code') code: string, @Req() req: { user: GiftStaff }) {
    return this.gifts.activate(code, req.user);
  }

  @Post('admin/gift-cards/:code/redeem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  redeem(@Param('code') code: string, @Body() body: { amount?: unknown }, @Req() req: { user: GiftStaff }) {
    return this.gifts.redeem(code, body?.amount, req.user);
  }

  @Post('admin/gift-cards/:code/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  cancel(@Param('code') code: string) {
    return this.gifts.cancel(code);
  }
}
