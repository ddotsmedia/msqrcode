import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrScan } from '../entities/qr-scan.entity';

const KINDS = ['table', 'branch', 'feedback', 'promo', 'stamp'];
const UUID = /^[a-f0-9-]{36}$/i;

@Injectable()
export class QrScansService {
  constructor(@InjectRepository(QrScan) private scans: Repository<QrScan>) {}

  // Public: the menu and the app report each scan. Only coarse, anonymous fields are stored.
  async record(body: Record<string, unknown>) {
    const kind = typeof body?.kind === 'string' ? body.kind : '';
    if (!KINDS.includes(kind)) throw new BadRequestException('Unknown scan kind');
    const branch = typeof body.branch_id === 'string' && UUID.test(body.branch_id) ? body.branch_id : null;
    const promo = typeof body.promotion_id === 'string' && UUID.test(body.promotion_id) ? body.promotion_id : null;
    const table = typeof body.table === 'string' && /^[\w-]{1,20}$/.test(body.table) ? body.table : null;
    await this.scans.save(this.scans.create({ kind, branch_id: branch, table_number: table, promotion_id: promo }));
    return { ok: true };
  }

  // Admin: scans per kind, busiest tables and offers, and scans by hour (Dubai time).
  async stats(daysRaw: unknown) {
    const days = Math.min(365, Math.max(1, Number(daysRaw) || 30));
    const since = new Date(Date.now() - days * 86_400_000);
    const [totals, tables, hours, promotions] = await Promise.all([
      this.scans.query('SELECT kind, COUNT(*)::int AS count FROM qr_scans WHERE created_at >= $1 GROUP BY kind ORDER BY count DESC', [since]),
      this.scans.query(
        `SELECT branch_id, table_number, COUNT(*)::int AS count FROM qr_scans
         WHERE kind = 'table' AND created_at >= $1 GROUP BY branch_id, table_number ORDER BY count DESC LIMIT 20`,
        [since],
      ),
      this.scans.query(
        `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Dubai')::int AS hour, COUNT(*)::int AS count
         FROM qr_scans WHERE created_at >= $1 GROUP BY hour ORDER BY hour`,
        [since],
      ),
      this.scans.query(
        `SELECT promotion_id, COUNT(*)::int AS count FROM qr_scans
         WHERE kind = 'promo' AND created_at >= $1 GROUP BY promotion_id ORDER BY count DESC LIMIT 20`,
        [since],
      ),
    ]);
    return { days, totals, tables, hours, promotions };
  }
}
