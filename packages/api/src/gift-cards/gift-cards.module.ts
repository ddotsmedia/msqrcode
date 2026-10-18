import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GiftCard } from '../entities/gift-card.entity';
import { GiftCardUse } from '../entities/gift-card-use.entity';
import { GiftCardsController } from './gift-cards.controller';
import { GiftCardsService } from './gift-cards.service';

@Module({
  imports: [TypeOrmModule.forFeature([GiftCard, GiftCardUse])],
  controllers: [GiftCardsController],
  providers: [GiftCardsService],
})
export class GiftCardsModule {}
