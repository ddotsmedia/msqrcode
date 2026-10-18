import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promotion } from '../entities/promotion.entity';
import { OfferEvent } from '../entities/offer-event.entity';
import { CouponRedemption } from '../entities/coupon-redemption.entity';
import { Order } from '../entities/order.entity';
import { OfferStatsService } from './offer-stats.service';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Promotion, OfferEvent, CouponRedemption, Order])],
  controllers: [PromotionsController],
  providers: [PromotionsService, OfferStatsService],
})
export class PromotionsModule {}
