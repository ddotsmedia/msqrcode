import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SeasonService } from './season.service';

@Controller()
export class SeasonController {
  constructor(private season: SeasonService) {}

  @Get('season')
  current() {
    return this.season.publicSeason();
  }

  @Get('admin/season')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  get() {
    return this.season.adminGet();
  }

  @Put('admin/season')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Body() body: Record<string, unknown>) {
    return this.season.update(body);
  }
}
