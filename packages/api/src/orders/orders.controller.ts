import { Controller, Post, Get, Put, Body, Param, Query, UseGuards, RawBodyRequest, Req, Sse, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { map } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrdersService } from './orders.service';
import { OrdersStreamService } from './orders-stream.service';

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService, private ordersStream: OrdersStreamService) {}

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

  @Sse('stream')
  getOrderStream(@Query('token') token: string): any {
    // For SSE, EventSource can't send custom headers, so we accept token as query param
    // For security, validate token if provided
    return this.ordersStream.getOrderStream().pipe(
      map((data) => ({ data })),
    );
  }
}
