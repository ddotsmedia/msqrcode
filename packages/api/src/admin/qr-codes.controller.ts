import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QrCodesService } from './qr-codes.service';

@Controller('admin/qr-codes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class QrCodesController {
  constructor(private qr: QrCodesService) {}

  @Get()
  list(@Query('branch_id') branchId?: string) {
    return this.qr.list(branchId);
  }

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.qr.create(body);
  }

  @Post('tables')
  createTables(@Body() body: Record<string, unknown>) {
    return this.qr.createTables(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.qr.update(id, body);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.qr.deactivate(id);
  }
}
