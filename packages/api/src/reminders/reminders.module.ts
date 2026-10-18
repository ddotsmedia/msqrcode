import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfferReminder } from '../entities/offer-reminder.entity';
import { Promotion } from '../entities/promotion.entity';
import { LoyaltyCard } from '../entities/loyalty-card.entity';
import { PushModule } from '../push/push.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [TypeOrmModule.forFeature([OfferReminder, Promotion, LoyaltyCard]), PushModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
