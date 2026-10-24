import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const n = (v: unknown) => Number(v ?? 0);

// Repeat-customer rate for loyalty-card holders. Only completed orders linked to a card count;
// guest orders are excluded because they cannot be matched to a customer.
@Injectable()
export class CustomersService {
  constructor(private db: DataSource) {}

  async customers(daysRaw: unknown, branchRaw: unknown) {
    const days = [7, 30, 90].includes(Number(daysRaw)) ? Number(daysRaw) : 30;
    const branch = typeof branchRaw === 'string' && branchRaw ? branchRaw : null;
    if (branch && !UUID.test(branch)) throw new BadRequestException('Unknown branch');

    const now = new Date();
    const dubaiMidnight = Math.floor((now.getTime() + 4 * 3600_000) / 864e5) * 864e5 - 4 * 3600_000;
    const since = new Date(dubaiMidnight - (days - 1) * 864e5);
    const prev = new Date(since.getTime() - days * 864e5);
    // $1 = from, $2 = to, $3 = branch (null = all branches)

    const period = (from: Date, to: Date) =>
      this.db.query(
        `WITH per_card AS (
           SELECT o.loyalty_card_id AS card, COUNT(*)::int AS orders
           FROM orders o
           WHERE o.status = 'completed' AND o.loyalty_card_id IS NOT NULL
             AND o.created_at >= $1 AND o.created_at < $2
             AND ($3::uuid IS NULL OR o.branch_id = $3::uuid)
           GROUP BY o.loyalty_card_id
         ),
         all_completed AS (
           SELECT COUNT(*)::int AS orders
           FROM orders o
           WHERE o.status = 'completed'
             AND o.created_at >= $1 AND o.created_at < $2
             AND ($3::uuid IS NULL OR o.branch_id = $3::uuid)
         )
         SELECT
           (SELECT COUNT(*)::int FROM per_card) AS customers,
           (SELECT COUNT(*)::int FROM per_card WHERE orders > 1) AS returning,
           (SELECT COALESCE(AVG(orders) FILTER (WHERE orders > 1), 0)::float FROM per_card) AS avg_orders_returning,
           (SELECT COALESCE(SUM(orders), 0)::int FROM per_card) AS card_orders,
           (SELECT orders FROM all_completed) AS completed_orders`,
        [from, to, branch],
      ).then((r) => r[0]);

    const [cur, pre] = await Promise.all([period(since, now), period(prev, since)]);

    const shape = (r: Record<string, unknown>) => {
      const customers = n(r.customers);
      const returning = n(r.returning);
      return {
        customers,
        returning,
        repeat_rate: customers ? returning / customers : 0,
        avg_orders_returning: n(r.avg_orders_returning),
        card_orders: n(r.card_orders),
        completed_orders: n(r.completed_orders),
        card_share: n(r.completed_orders) ? n(r.card_orders) / n(r.completed_orders) : 0,
      };
    };

    return { days, kpis: { current: shape(cur), previous: shape(pre) } };
  }
}
