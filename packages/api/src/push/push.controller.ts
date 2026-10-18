import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
