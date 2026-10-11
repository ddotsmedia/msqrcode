import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private branchesRepository: Repository<Branch>,
  ) {}

  async findAll(): Promise<Branch[]> {
    return this.branchesRepository.find({
      where: { status: 'active' },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Branch> {
    const branch = await this.branchesRepository.findOne({
      where: { id },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    return branch;
  }

  async findByCode(code: string): Promise<Branch> {
    const branch = await this.branchesRepository.findOne({
      where: { code, status: 'active' },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with code ${code} not found`);
    }

    return branch;
  }

  async create(branchData: Partial<Branch>): Promise<Branch> {
    const branch = this.branchesRepository.create(branchData);
    return this.branchesRepository.save(branch);
  }

  async update(id: string, branchData: Partial<Branch>): Promise<Branch> {
    await this.branchesRepository.update(id, branchData);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.branchesRepository.delete(id);
  }
}
