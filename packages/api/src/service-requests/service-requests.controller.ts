import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ServiceRequestsService, StaffUser } from './service-requests.service';

@Controller()
export class ServiceRequestsController {
  constructor(private service: ServiceRequestsService) {}

  // Customer at a table: "Call staff" or "Ask for the bill".
  @Post('service-requests')
  create(@Body() body: Record<string, unknown>) {
    return this.service.create(body);
  }

  @Get('service-requests/:id')
  status(@Param('id') id: string) {
    return this.service.status(id);
  }

  @Get('admin/service-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  list(@Query('branch_id') branchId: string | undefined, @Req() req: { user: StaffUser }) {
    return this.service.list(branchId, req.user);
  }

  @Patch('admin/service-requests/:id/done')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  done(@Param('id') id: string, @Req() req: { user: StaffUser }) {
    return this.service.markDone(id, req.user);
  }
}
