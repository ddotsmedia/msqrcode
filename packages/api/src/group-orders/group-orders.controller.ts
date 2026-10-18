import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { GroupOrdersService } from './group-orders.service';

@Controller('group-orders')
export class GroupOrdersController {
  constructor(private groups: GroupOrdersService) {}

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.groups.create(body);
  }

  @Get(':code')
  get(@Param('code') code: string, @Query('key') key?: string) {
    return this.groups.get(code, key);
  }

  @Put(':code/items')
  setItems(@Param('code') code: string, @Body() body: Record<string, unknown>) {
    return this.groups.setItems(code, body);
  }

  @Post(':code/submit')
  submit(@Param('code') code: string, @Body() body: Record<string, unknown>) {
    return this.groups.submit(code, body);
  }

  @Post(':code/cancel')
  cancel(@Param('code') code: string, @Body() body: Record<string, unknown>) {
    return this.groups.cancel(code, body);
  }
}
