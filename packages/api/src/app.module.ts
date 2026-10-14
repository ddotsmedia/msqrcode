import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { HealthModule } from './health/health.module';
import * as entities from './entities';
import { BranchesModule } from './branches/branches.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { AvailabilityModule } from './availability/availability.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { FeedbackModule } from './feedback/feedback.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { PromotionsModule } from './promotions/promotions.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      load: [configuration],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'milestones',
      // DB_SYNC=true creates tables from entities on first boot; turn it off afterwards.
      synchronize: process.env.NODE_ENV === 'development' || process.env.DB_SYNC === 'true',
      entities: Object.values(entities),
      logging: process.env.NODE_ENV === 'development',
    }),
    HealthModule,
    BranchesModule,
    ProductsModule,
    CategoriesModule,
    AvailabilityModule,
    AnalyticsModule,
    AuthModule,
    AdminModule,
    FeedbackModule,
    LoyaltyModule,
    PromotionsModule,
    OrdersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
