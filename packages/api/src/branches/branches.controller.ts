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

  @Post()
  async create(@Body() branchData: Partial<Branch>): Promise<Branch> {
    return this.branchesService.create(branchData);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() branchData: Partial<Branch>,
  ): Promise<Branch> {
    return this.branchesService.update(id, branchData);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.branchesService.delete(id);
  }
}
