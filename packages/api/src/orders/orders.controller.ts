import { Controller, Post, Get, Put, Body, Param, Query, UseGuards, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post()
  async create(@Query('branch') branchId: string, @Body() body: Record<string, unknown>) {
    return this.orders.create(branchId, body);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Query('access_token') accessToken?: string) {
    return this.orders.getById(id, accessToken);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  async updateStatus(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.orders.updateStatus(id, String(body.status));
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  async listByBranch(@Query('branch') branchId: string) {
    return this.orders.listByBranch(branchId);
  }
}
