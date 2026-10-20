import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QrScansService } from './qr-scans.service';

@Controller()
export class QrScansController {
  constructor(private scans: QrScansService) {}

  @Post('qr/scans')
  record(@Body() body: Record<string, unknown>) {
    return this.scans.record(body);
  }

  @Get('admin/qr/scans/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  stats(@Query('days') days?: string) {
    return this.scans.stats(days);
  }
}
