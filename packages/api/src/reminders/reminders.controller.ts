import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RemindersService } from './reminders.service';

@Controller()
export class RemindersController {
  constructor(private reminders: RemindersService) {}

  @Get('offers/reminders')
  list(@Query('token') token?: string) {
    return this.reminders.list(token);
  }

  @Post('offers/reminders')
  set(@Body() body: { token?: unknown; promotion_id?: unknown; on?: unknown }) {
    return this.reminders.set(body);
  }
}
