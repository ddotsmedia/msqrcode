import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PushService } from './push.service';

@Controller()
export class PushController {
  constructor(private push: PushService) {}

  @Get('push/key')
  key() {
    return this.push.publicKey();
  }

  @Post('push/subscribe')
  subscribe(@Body() body: Record<string, unknown>) {
    return this.push.subscribe(body);
  }

  // iPhone / Android app phones (native push).
  @Post('push/devices')
  registerDevice(@Body() body: Record<string, unknown>) {
    return this.push.registerDevice(body);
  }

  @Post('push/devices/remove')
  unregisterDevice(@Body() body: Record<string, unknown>) {
    return this.push.unregisterDevice(body);
  }

  // Staff app: any signed-in staff user; alerts follow their branch.
  @Post('push/staff-devices')
  @UseGuards(JwtAuthGuard)
  registerStaff(@Body() body: Record<string, unknown>, @Req() req: { user: { id: string; role: string; assigned_branch_id?: string | null } }) {
    return this.push.registerDevice(body, req.user);
  }

  // The apps ask on start whether they are too old (APP_MIN_VERSION) and where to update.
  @Get('app/version')
  appVersion() {
    return {
      min_version: process.env.APP_MIN_VERSION || '1.0.0',
      ios_url: process.env.APP_IOS_URL || null,
      android_url: process.env.APP_ANDROID_URL || null,
    };
  }

  @Post('push/unsubscribe')
  unsubscribe(@Body() body: Record<string, unknown>) {
    return this.push.unsubscribe(body);
  }

  @Get('admin/push/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  stats() {
    return this.push.stats();
  }

  @Post('admin/push/broadcast')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  broadcast(@Body() body: Record<string, unknown>) {
    return this.push.broadcast(body);
  }
}
