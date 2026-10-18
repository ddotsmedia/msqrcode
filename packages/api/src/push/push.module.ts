import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscription } from '../entities/push-subscription.entity';
import { AppSecret } from '../entities/app-secret.entity';
import { LoyaltyCard } from '../entities/loyalty-card.entity';
import { DeviceToken } from '../entities/device-token.entity';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription, AppSecret, LoyaltyCard, DeviceToken])],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
