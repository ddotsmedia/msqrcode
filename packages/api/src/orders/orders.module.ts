import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { Branch } from '../entities/branch.entity';
import { BranchProductPrice } from '../entities/branch-product-price.entity';
import { ProductAvailability } from '../entities/product-availability.entity';
import { Promotion } from '../entities/promotion.entity';
import { LoyaltyCard } from '../entities/loyalty-card.entity';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { CorporateModule } from '../corporate/corporate.module';
import { PushModule } from '../push/push.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product, Branch, BranchProductPrice, ProductAvailability, Promotion, LoyaltyCard]), LoyaltyModule, CorporateModule, PushModule],
  providers: [OrdersService],
  exports: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
