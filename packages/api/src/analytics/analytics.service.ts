import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from '../entities/analytics-event.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private analyticsRepository: Repository<AnalyticsEvent>,
  ) {}

  async logEvent(eventData: Partial<AnalyticsEvent>): Promise<AnalyticsEvent> {
    const event = this.analyticsRepository.create(eventData);
    return this.analyticsRepository.save(event);
  }

  async getViewStats(branchId?: string, startDate?: Date, endDate?: Date): Promise<any> {
    let query = this.analyticsRepository
      .createQueryBuilder('event')
      .where('event.event_type = :eventType', { eventType: 'page_view' });

    if (branchId) {
      query = query.andWhere('event.branch_id = :branchId', { branchId });
    }

    if (startDate) {
      query = query.andWhere('event.created_at >= :startDate', { startDate });
    }

    if (endDate) {
      query = query.andWhere('event.created_at <= :endDate', { endDate });
    }

    const count = await query.getCount();
    return { event_type: 'page_view', count };
  }

  async getProductViewStats(branchId?: string): Promise<any[]> {
    let query = this.analyticsRepository
      .createQueryBuilder('event')
      .select('event.product_id', 'product_id')
      .addSelect('COUNT(*)', 'count')
      .where('event.event_type = :eventType', { eventType: 'product_view' })
      .groupBy('event.product_id')
      .orderBy('count', 'DESC');

    if (branchId) {
      query = query.andWhere('event.branch_id = :branchId', { branchId });
    }

    return query.getRawMany();
  }

  async getSearchStats(branchId?: string): Promise<any[]> {
    let query = this.analyticsRepository
      .createQueryBuilder('event')
      .select('event.search_query', 'search_query')
      .addSelect('COUNT(*)', 'count')
      .where('event.event_type = :eventType', { eventType: 'search' })
      .andWhere('event.search_query IS NOT NULL')
      .groupBy('event.search_query')
      .orderBy('count', 'DESC')
      .limit(20);

    if (branchId) {
      query = query.andWhere('event.branch_id = :branchId', { branchId });
    }

    return query.getRawMany();
  }

  async getFeedbackStats(branchId?: string): Promise<any[]> {
    let query = this.analyticsRepository
      .createQueryBuilder('event')
      .select('event.feedback_rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .addSelect('AVG(event.feedback_rating)', 'average')
      .where('event.event_type = :eventType', { eventType: 'feedback' })
      .andWhere('event.feedback_rating IS NOT NULL');

    if (branchId) {
      query = query.andWhere('event.branch_id = :branchId', { branchId });
    }

    query = query.groupBy('event.feedback_rating').orderBy('event.feedback_rating', 'ASC');

    return query.getRawMany();
  }
}
