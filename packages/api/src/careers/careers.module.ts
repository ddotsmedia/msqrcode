import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobApplication } from '../entities/job-application.entity';
import { Branch } from '../entities/branch.entity';
import { CareersController } from './careers.controller';
import { CareersService } from './careers.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobApplication, Branch])],
  controllers: [CareersController],
  providers: [CareersService],
})
export class CareersModule {}
