import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeasonSettings } from '../entities/season-settings.entity';
import { SeasonController } from './season.controller';
import { SeasonService } from './season.service';

// Global so the public branch endpoints can swap in Ramadan hours.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SeasonSettings])],
  controllers: [SeasonController],
  providers: [SeasonService],
  exports: [SeasonService],
})
export class SeasonModule {}
