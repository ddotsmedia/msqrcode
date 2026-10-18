import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CateringRequest } from '../entities/catering-request.entity';
import { Branch } from '../entities/branch.entity';
import { CateringController } from './catering.controller';
import { CateringService } from './catering.service';

@Module({
  imports: [TypeOrmModule.forFeature([CateringRequest, Branch])],
  controllers: [CateringController],
  providers: [CateringService],
})
export class CateringModule {}
