import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupOrder } from '../entities/group-order.entity';
import { Branch } from '../entities/branch.entity';
import { Order } from '../entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { GroupOrdersController } from './group-orders.controller';
import { GroupOrdersService } from './group-orders.service';

@Module({
  imports: [TypeOrmModule.forFeature([GroupOrder, Branch, Order]), OrdersModule],
  controllers: [GroupOrdersController],
  providers: [GroupOrdersService],
})
export class GroupOrdersModule {}
