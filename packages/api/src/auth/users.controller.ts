import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { UsersService } from './users.service';
import { PERMISSIONS } from './permissions';

// Full admins only (no section gives access to user management).
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get('permissions')
  permissions() {
    return PERMISSIONS;
  }

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.users.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: { user: { id: string } }) {
    return this.users.update(id, body, req.user);
  }
}
