import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const n = (v: unknown) => Number(v ?? 0);

// Menu performance from completed orders: units and revenue per item, category mix,
// and top and bottom sellers. Revenue is unit_price x qty, so option surcharges are not included.
@Injectable()
export class MenuService {
  constructor(private db: DataSource) {}

  async menu(daysRaw: unknown, branchRaw: unknown) {
    const days = [7, 30, 90].includes(Number(daysRaw)) ? Number(daysRaw) : 30;
    const branch = typeof branchRaw === 'string' && branchRaw ? branchRaw : null;
    if (branch && !UUID.test(branch)) throw new BadRequestException('Unknown branch');

    const now = new Date();
    const dubaiMidnight = Math.floor((now.getTime() + 4 * 3600_000) / 864e5) * 864e5 - 4 * 3600_000;
    const since = new Date(dubaiMidnight - (days - 1) * 864e5);
    // $1 = from, $2 = to, $3 = branch (null = all branches)
    const base = `FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE o.status = 'completed'
        AND o.created_at >= $1 AND o.created_at < $2
        AND ($3::uuid IS NULL OR o.branch_id = $3::uuid)`;

    const [items, categories, totals] = await Promise.all([
      this.db.query(
        `SELECT COALESCE(p.id::text, oi.name_snapshot) AS key,
                oi.name_snapshot AS name,
                COALESCE(SUM(oi.qty), 0)::int AS units,
                COALESCE(SUM(oi.unit_price * oi.qty), 0)::float AS revenue
         ${base}
         GROUP BY 1, 2
         ORDER BY units DESC, revenue DESC`,
        [since, now, branch],
      ),
      this.db.query(
        `SELECT COALESCE(c.name, 'Uncategorised') AS category,
                COALESCE(SUM(oi.qty), 0)::int AS units,
                COALESCE(SUM(oi.unit_price * oi.qty), 0)::float AS revenue
         ${base}
         GROUP BY 1
         ORDER BY revenue DESC`,
        [since, now, branch],
      ),
      this.db.query(
        `SELECT COALESCE(SUM(oi.qty), 0)::int AS units,
                COALESCE(SUM(oi.unit_price * oi.qty), 0)::float AS revenue
         ${base}`,
        [since, now, branch],
      ).then((r) => r[0]),
    ]);

    const mapItem = (r: Record<string, unknown>) => ({ name: r.name, units: n(r.units), revenue: n(r.revenue) });
    const all = items.map(mapItem);
    const totalRevenue = n(totals.revenue);

    return {
      days,
      totals: { units: n(totals.units), revenue: totalRevenue, items_sold: all.length },
      top_sellers: all.slice(0, 10),
      // Lowest sellers among items that sold at least once in the period.
      bottom_sellers: [...all].reverse().slice(0, 10),
      categories: categories.map((r: Record<string, unknown>) => ({
        name: r.category,
        units: n(r.units),
        revenue: n(r.revenue),
        share: totalRevenue ? n(r.revenue) / totalRevenue : 0,
      })),
    };
  }
}
