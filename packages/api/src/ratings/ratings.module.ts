import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { ProductRating } from '../entities/product-rating.entity';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, ProductRating])],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
