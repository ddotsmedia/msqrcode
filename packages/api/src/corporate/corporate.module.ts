import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorporateAccount } from '../entities/corporate-account.entity';
import { CorporateInvoice } from '../entities/corporate-invoice.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Branch } from '../entities/branch.entity';
import { CorporateController } from './corporate.controller';
import { CorporateService } from './corporate.service';

@Module({
  imports: [TypeOrmModule.forFeature([CorporateAccount, CorporateInvoice, Order, OrderItem, Branch])],
  controllers: [CorporateController],
  providers: [CorporateService],
  exports: [CorporateService],
})
export class CorporateModule {}
