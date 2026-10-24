import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductAvailability } from '../entities/product-availability.entity';
import { ProductAvailabilityLog } from '../entities/product-availability-log.entity';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductAvailability, ProductAvailabilityLog])],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
