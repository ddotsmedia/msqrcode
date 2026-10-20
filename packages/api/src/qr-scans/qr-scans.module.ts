import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrScan } from '../entities/qr-scan.entity';
import { QrScansController } from './qr-scans.controller';
import { QrScansService } from './qr-scans.service';

@Module({
  imports: [TypeOrmModule.forFeature([QrScan])],
  controllers: [QrScansController],
  providers: [QrScansService],
})
export class QrScansModule {}
