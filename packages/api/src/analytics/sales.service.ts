import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Local Dubai time, matching InsightsService.
const LOCAL = (col: string) => `(${col}::timestamptz AT TIME ZONE 'Asia/Dubai')`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const n = (v: unknown) => Number(v ?? 0);

// Revenue counts completed orders only; cancelled and still-open orders are reported as counts.
@Injectable()
export class SalesService {
  constructor(private db: DataSource) {}

  async sales(daysRaw: unknown, branchRaw: unknown) {
    const days = [7, 30, 90].includes(Number(daysRaw)) ? Number(daysRaw) : 30;
    const branch = typeof branchRaw === 'string' && branchRaw ? branchRaw : null;
    if (branch && !UUID.test(branch)) throw new BadRequestException('Unknown branch');

    const now = new Date();
    const dubaiMidnight = Math.floor((now.getTime() + 4 * 3600_000) / 864e5) * 864e5 - 4 * 3600_000;
    const since = new Date(dubaiMidnight - (days - 1) * 864e5);
    const prev = new Date(since.getTime() - days * 864e5);
    // $1 = from, $2 = to, $3 = branch (null = all branches)
    const bf = `($3::uuid IS NULL OR o.branch_id = $3::uuid)`;

    const totals = (from: Date, to: Date) =>
      this.db.query(
        `SELECT
           COUNT(*) FILTER (WHERE o.status = 'completed')::int AS completed,
           COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled,
           COUNT(*) FILTER (WHERE o.status IN ('placed','preparing','ready'))::int AS open,
           COALESCE(SUM(o.total) FILTER (WHERE o.status = 'completed'), 0)::float AS revenue
         FROM orders o
         WHERE o.created_at >= $1 AND o.created_at < $2 AND ${bf}`,
        [from, to, branch],
      ).then((r) => r[0]);

    const [cur, pre, daily, byBranch, byType] = await Promise.all([
      totals(since, now),
      totals(prev, since),
      this.db.query(
        `SELECT to_char(${LOCAL('o.created_at')}, 'YYYY-MM-DD') AS day,
                COUNT(*) FILTER (WHERE o.status = 'completed')::int AS orders,
                COALESCE(SUM(o.total) FILTER (WHERE o.status = 'completed'), 0)::float AS revenue
         FROM orders o
         WHERE o.created_at >= $1 AND o.created_at < $2 AND ${bf}
         GROUP BY 1 ORDER BY 1`,
        [since, now, branch],
      ),
      this.db.query(
        `SELECT b.id, b.name,
                COUNT(*) FILTER (WHERE o.status = 'completed')::int AS orders,
                COALESCE(SUM(o.total) FILTER (WHERE o.status = 'completed'), 0)::float AS revenue
         FROM orders o JOIN branches b ON b.id = o.branch_id
         WHERE o.created_at >= $1 AND o.created_at < $2 AND ${bf}
         GROUP BY b.id, b.name ORDER BY revenue DESC`,
        [since, now, branch],
      ),
      this.db.query(
        `SELECT o.type,
                COUNT(*) FILTER (WHERE o.status = 'completed')::int AS orders,
                COALESCE(SUM(o.total) FILTER (WHERE o.status = 'completed'), 0)::float AS revenue
         FROM orders o
         WHERE o.created_at >= $1 AND o.created_at < $2 AND ${bf}
         GROUP BY o.type ORDER BY revenue DESC`,
        [since, now, branch],
      ),
    ]);

    const avg = (t: { revenue: number; completed: number }) => (t.completed ? t.revenue / t.completed : 0);
    const kpi = (t: { revenue: number; completed: number; cancelled: number; open: number }) => ({
      revenue: n(t.revenue),
      completed: n(t.completed),
      cancelled: n(t.cancelled),
      open: n(t.open),
      average_order_value: avg(t),
    });

    return {
      days,
      kpis: { current: kpi(cur), previous: kpi(pre) },
      daily: daily.map((r: Record<string, unknown>) => ({ day: r.day, orders: n(r.orders), revenue: n(r.revenue) })),
      branches: byBranch.map((r: Record<string, unknown>) => ({ id: r.id, name: r.name, orders: n(r.orders), revenue: n(r.revenue) })),
      types: byType.map((r: Record<string, unknown>) => ({ type: r.type, orders: n(r.orders), revenue: n(r.revenue) })),
    };
  }
}
