import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import { BranchFeedback } from '../entities/branch-feedback.entity';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(BranchFeedback) private feedback: Repository<BranchFeedback>,
    @InjectRepository(Branch) private branches: Repository<Branch>,
  ) {}

  async submit(branchId: string, body: { rating?: unknown; comment?: unknown }) {
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be a whole number from 1 to 5');
    }
    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 500) : null;
    const branch = await this.branches.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    const row = this.feedback.create({ branch_id: branchId, rating, comment: comment || null });
    await this.feedback.save(row);
    return { ok: true };
  }

  // Admin: latest feedback for a branch plus average rating.
  async listForBranch(branchId: string) {
    const rows = await this.feedback.find({
      where: { branch_id: branchId },
      order: { created_at: 'DESC' },
      take: 100,
    });
    const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;
    return { average: avg === null ? null : Number(avg.toFixed(2)), count: rows.length, items: rows };
  }
}
