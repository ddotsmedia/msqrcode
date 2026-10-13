import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { Branch } from '../entities/branch.entity';

@Controller('branches')
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Get()
  async findAll(): Promise<Branch[]> {
    return this.branchesService.findAll();
  }

  @Get(':id/menu-image')
  async menuImage(@Param('id') id: string) {
    return this.branchesService.getMenuImage(id);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Branch> {
    return this.branchesService.findById(id);
  }

  @Get('code/:code')
  async findByCode(@Param('code') code: string): Promise<Branch> {
    return this.branchesService.findByCode(code);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  async create(@Body() branchData: Partial<Branch>): Promise<Branch> {
    return this.branchesService.create(branchData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() branchData: Partial<Branch>,
  ): Promise<Branch> {
    return this.branchesService.update(id, branchData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.branchesService.delete(id);
  }
}
