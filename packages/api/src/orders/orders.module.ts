import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { BranchProductPrice } from '../entities/branch-product-price.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { MockPaymentProvider } from '../payments/mock-payment.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product, BranchProductPrice])],
  providers: [OrdersService, { provide: 'PaymentProvider', useClass: MockPaymentProvider }],
  controllers: [OrdersController],
})
export class OrdersModule {}
