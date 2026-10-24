import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductAvailability } from '../entities/product-availability.entity';
import { ProductAvailabilityLog } from '../entities/product-availability-log.entity';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(ProductAvailability)
    private availabilityRepository: Repository<ProductAvailability>,
    @InjectRepository(ProductAvailabilityLog)
    private logRepository: Repository<ProductAvailabilityLog>,
  ) {}

  async getByBranch(branchId: string): Promise<ProductAvailability[]> {
    return this.availabilityRepository.find({
      where: { branch_id: branchId },
      relations: ['product'],
    });
  }

  async getByBranchAndProduct(branchId: string, productId: string): Promise<ProductAvailability> {
    const availability = await this.availabilityRepository.findOne({
      where: { branch_id: branchId, product_id: productId },
    });

    if (!availability) {
      throw new NotFoundException(
        `Availability record not found for branch ${branchId} and product ${productId}`,
      );
    }

    return availability;
  }

  async updateAvailability(
    branchId: string,
    productId: string,
    isAvailable: boolean,
    userId?: string,
  ): Promise<ProductAvailability> {
    const availability = await this.availabilityRepository.findOne({
      where: { branch_id: branchId, product_id: productId },
    });

    if (!availability) {
      // Create new availability record if it doesn't exist
      const newRecord = this.availabilityRepository.create({
        branch_id: branchId,
        product_id: productId,
        is_available: isAvailable,
        updated_by_user_id: userId,
      });
      const saved = await this.availabilityRepository.save(newRecord);
      await this.logChange(branchId, productId, isAvailable, userId);
      return saved;
    }

    const changed = availability.is_available !== isAvailable;
    availability.is_available = isAvailable;
    availability.updated_by_user_id = userId ?? null;
    const saved = await this.availabilityRepository.save(availability);
    if (changed) await this.logChange(branchId, productId, isAvailable, userId);
    return saved;
  }

  private async logChange(branchId: string, productId: string, isAvailable: boolean, userId?: string) {
    await this.logRepository.save(
      this.logRepository.create({
        branch_id: branchId,
        product_id: productId,
        is_available: isAvailable,
        changed_by_user_id: userId ?? null,
      }),
    );
  }

  async initializeForBranch(branchId: string, productIds: string[]): Promise<void> {
    const existing = await this.availabilityRepository.find({
      where: { branch_id: branchId },
    });

    const existingProductIds = existing.map((a) => a.product_id);
    const missingProductIds = productIds.filter((id) => !existingProductIds.includes(id));

    if (missingProductIds.length > 0) {
      const records = missingProductIds.map((productId) =>
        this.availabilityRepository.create({
          branch_id: branchId,
          product_id: productId,
          is_available: true,
        }),
      );
      await this.availabilityRepository.save(records);
    }
  }
}
