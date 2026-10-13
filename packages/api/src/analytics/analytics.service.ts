import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from '../entities/analytics-event.entity';
import { Branch } from '../entities/branch.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private analyticsRepository: Repository<AnalyticsEvent>,
    @InjectRepository(Branch)
    private branches: Repository<Branch>,
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

  async getBranchAnalytics(from?: Date, to?: Date): Promise<any> {
    const branches = await this.branches.find();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let scansToday = 0;
    let totalBranches = 0;
    let activeBranches = 0;
    let pausedBranches = 0;

    const branchAnalytics = await Promise.all(
      branches.map(async (branch) => {
        const scans = await this.analyticsRepository
          .createQueryBuilder('e')
          .where('e.branch_id = :id', { id: branch.id })
          .andWhere('e.event_type = :type', { type: 'page_view' })
          .getCount();

        const views = await this.analyticsRepository
          .createQueryBuilder('e')
          .where('e.branch_id = :id', { id: branch.id })
          .getCount();

        const dailyScans = await Promise.all(
          Array.from({ length: 7 }, async (_, i) => {
            const dayStart = new Date(sevenDaysAgo);
            dayStart.setDate(dayStart.getDate() + i);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            return this.analyticsRepository
              .createQueryBuilder('e')
              .where('e.branch_id = :id', { id: branch.id })
              .andWhere('e.event_type = :type', { type: 'page_view' })
              .andWhere('e.created_at >= :start', { start: dayStart })
              .andWhere('e.created_at < :end', { end: dayEnd })
              .getCount();
          }),
        );

        const isTodayActive = dailyScans[6] > 0;

        return {
          branch_id: branch.id,
          branch_name: branch.name,
          scans,
          page_views: views,
          last_menu_update: branch.updated_at.toISOString(),
          paused: branch.status === 'inactive',
          zero_scans_7d: dailyScans.every((s) => s === 0),
          daily_scans: dailyScans,
        };
      }),
    );

    totalBranches = branches.length;
    activeBranches = branches.filter((b) => b.status === 'active').length;
    pausedBranches = branches.filter((b) => b.status === 'inactive').length;

    scansToday = await this.analyticsRepository
      .createQueryBuilder('e')
      .where('e.event_type = :type', { type: 'page_view' })
      .andWhere('e.created_at >= :start', { start: today })
      .getCount();

    return {
      total: totalBranches,
      active: activeBranches,
      paused: pausedBranches,
      scans_today: scansToday,
      branches: branchAnalytics,
    };
  }
}
