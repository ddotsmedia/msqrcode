import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CateringService } from './catering.service';

@Controller()
export class CateringController {
  constructor(private catering: CateringService) {}

  @Post('catering')
  create(@Body() body: Record<string, unknown>) {
    return this.catering.create(body);
  }

  @Get('admin/catering')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  list(@Query('status') status?: string) {
    return this.catering.list(status);
  }

  @Patch('admin/catering/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  setStatus(@Param('id') id: string, @Body() body: { status?: unknown }) {
    return this.catering.setStatus(id, body?.status);
  }
}
