import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminBranchesService } from './admin-branches.service';

@Controller('admin/branches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminBranchesController {
  constructor(private branches: AdminBranchesService) {}

  @Get()
  list() {
    return this.branches.list();
  }

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.branches.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.branches.update(id, body);
  }
}
