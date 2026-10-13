import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { OptionGroup } from '../entities/option-group.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category, ProductVariant, OptionGroup])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
