import { Controller, Get, Put, Param, Body, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { ProductAvailability } from '../entities/product-availability.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('branches/:branchId/products')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Get('availability')
  async getByBranch(@Param('branchId') branchId: string): Promise<ProductAvailability[]> {
    return this.availabilityService.getByBranch(branchId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  @Put(':productId/availability')
  async updateAvailability(
    @Req() req: { user: { id: string; role: string; assigned_branch_id?: string | null } },
    @Param('branchId') branchId: string,
    @Param('productId') productId: string,
    @Body() body: { is_available: boolean },
  ): Promise<ProductAvailability> {
    const user = req.user;
    if (user.role === 'branch_manager' && user.assigned_branch_id !== branchId) {
      throw new ForbiddenException('Branch managers can only update their own branch');
    }
    return this.availabilityService.updateAvailability(
      branchId,
      productId,
      body.is_available,
      user.id,
    );
  }
}
