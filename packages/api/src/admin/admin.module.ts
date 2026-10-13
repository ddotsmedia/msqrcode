import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { OptionGroup } from '../entities/option-group.entity';
import { Branch } from '../entities/branch.entity';
import { QrCode } from '../entities/qr-code.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { QrCodesController } from './qr-codes.controller';
import { QrCodesService } from './qr-codes.service';
import { AdminBranchesController } from './admin-branches.controller';
import { AdminBranchesService } from './admin-branches.service';
import { MenuImportController } from './menu-import.controller';
import { MenuImportService } from './menu-import.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category, ProductVariant, OptionGroup, Branch, QrCode])],
  controllers: [AdminController, QrCodesController, AdminBranchesController, MenuImportController],
  providers: [AdminService, QrCodesService, AdminBranchesService, MenuImportService],
})
export class AdminModule {}
