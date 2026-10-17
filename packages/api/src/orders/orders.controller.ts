import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrdersService, StaffUser } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private orders: OrdersService) {}

  // Customer: order from the table or order ahead for pickup (pay at the counter).
  @Post('orders')
  create(@Body() body: Record<string, unknown>) {
    return this.orders.create(body);
  }

  @Get('orders/:id')
  track(@Param('id') id: string, @Query('token') token?: string) {
    return this.orders.track(id, token);
  }

  @Post('orders/:id/cancel')
  cancel(@Param('id') id: string, @Body() body: { token?: unknown }) {
    return this.orders.cancel(id, body?.token);
  }

  @Get('admin/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  list(@Query('branch_id') branchId: string | undefined, @Req() req: { user: StaffUser }) {
    return this.orders.list(branchId, req.user);
  }

  @Patch('admin/orders/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  setStatus(@Param('id') id: string, @Body() body: { status?: unknown }, @Req() req: { user: StaffUser }) {
    return this.orders.setStatus(id, body?.status, req.user);
  }

  @Patch('admin/orders/ordering')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  setOrdering(@Body() body: { branch_id?: unknown; enabled?: unknown; kind?: unknown }, @Req() req: { user: StaffUser }) {
    return this.orders.setOrdering(body?.branch_id, body?.enabled, req.user, body?.kind);
  }
}
