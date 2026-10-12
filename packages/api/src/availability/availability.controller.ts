import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { ProductAvailability } from '../entities/product-availability.entity';

@Controller('branches/:branchId/products')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Get('availability')
  async getByBranch(@Param('branchId') branchId: string): Promise<ProductAvailability[]> {
    return this.availabilityService.getByBranch(branchId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':productId/availability')
  async updateAvailability(
    @Param('branchId') branchId: string,
    @Param('productId') productId: string,
    @Body() body: { is_available: boolean; user_id?: string },
  ): Promise<ProductAvailability> {
    return this.availabilityService.updateAvailability(
      branchId,
      productId,
      body.is_available,
      body.user_id,
    );
  }
}
