import { UseGuards } from '@nestjs/common';
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

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Branch> {
    return this.branchesService.findById(id);
  }

  @Get('code/:code')
  async findByCode(@Param('code') code: string): Promise<Branch> {
    return this.branchesService.findByCode(code);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() branchData: Partial<Branch>): Promise<Branch> {
    return this.branchesService.create(branchData);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() branchData: Partial<Branch>,
  ): Promise<Branch> {
    return this.branchesService.update(id, branchData);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.branchesService.delete(id);
  }
}
