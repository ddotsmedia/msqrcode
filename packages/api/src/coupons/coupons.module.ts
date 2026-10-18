import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CouponRedemption } from '../entities/coupon-redemption.entity';
import { Promotion } from '../entities/promotion.entity';
import { LoyaltyCard } from '../entities/loyalty-card.entity';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  imports: [TypeOrmModule.forFeature([CouponRedemption, Promotion, LoyaltyCard])],
  controllers: [CouponsController],
  providers: [CouponsService],
})
export class CouponsModule {}
