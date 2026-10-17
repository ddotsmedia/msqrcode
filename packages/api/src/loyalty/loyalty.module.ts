import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoyaltyCard } from '../entities/loyalty-card.entity';
import { LoyaltyEvent } from '../entities/loyalty-event.entity';
import { LoyaltySettings } from '../entities/loyalty-settings.entity';
import { User } from '../entities/user.entity';
import { Branch } from '../entities/branch.entity';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { PushModule } from '../push/push.module';

@Module({
  imports: [TypeOrmModule.forFeature([LoyaltyCard, LoyaltyEvent, LoyaltySettings, User, Branch]), PushModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
})
export class LoyaltyModule {}
