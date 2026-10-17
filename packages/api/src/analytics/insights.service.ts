import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Local Dubai time for both plain and time-zone-aware columns, whatever the database's own time zone.
const LOCAL = (col: string) => `(${col}::timestamptz AT TIME ZONE 'Asia/Dubai')`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_VIEW = `event_type IN ('product_selected','product_view')`;

type Row = Record<string, string | number | null>;
const n = (v: unknown) => Number(v ?? 0);

// One call that feeds the admin Insights page. Every query is scoped to the chosen
// period (and branch when given) and compared with the period just before it.
@Injectable()
export class InsightsService {
  constructor(private db: DataSource) {}

  async insights(daysRaw: unknown, branchRaw: unknown) {
    const days = [7, 30, 90].includes(Number(daysRaw)) ? Number(daysRaw) : 30;
    const branch = typeof branchRaw === 'string' && branchRaw ? branchRaw : null;
    if (branch && !UUID.test(branch)) throw new BadRequestException('Unknown branch');
    const now = new Date();
    // Start at Dubai midnight so every day on the charts is a whole day (today is the last, partial one).
    const dubaiMidnight = Math.floor((now.getTime() + 4 * 3600_000) / 864e5) * 864e5 - 4 * 3600_000;
    const since = new Date(dubaiMidnight - (days - 1) * 864e5);
    const prev = new Date(since.getTime() - days * 864e5);
    // $1 = since, $2 = until, $3 = branch (or null = all branches)
    const bf = (col = 'branch_id') => `($3::uuid IS NULL OR ${col} = $3::uuid)`;
    // Postgres rejects unused parameters, so pass only as many as the query refers to.
    const q = (sql: string, from = since, to = now) => {
      const used = Math.max(0, ...[...sql.matchAll(/\$(\d)/g)].map((m) => Number(m[1])));
      return this.db.query(sql, [from, to, branch].slice(0, used)) as Promise<Row[]>;
    };
    const window = (col = 'created_at') => `${col} >= $1 AND ${col} < $2`;

    const kpiSql = `
      SELECT
        (SELECT count(*) FROM analytics_events WHERE event_type = 'page_view' AND ${window()} AND ${bf()}) AS views,
        (SELECT count(*) FROM analytics_events WHERE ${PRODUCT_VIEW} AND ${window()} AND ${bf()}) AS product_views,
        (SELECT count(*) FROM analytics_events WHERE event_type = 'search' AND ${window()} AND ${bf()}) AS searches,
        (SELECT count(*) FROM loyalty_events WHERE type = 'stamp' AND ${window()} AND ${bf()}) AS stamps,
        (SELECT count(*) FROM loyalty_events WHERE type = 'redeem' AND ${window()} AND ${bf()}) AS redemptions,
        (SELECT count(*) FROM loyalty_cards WHERE ${window()} AND $3::uuid IS NULL) AS new_members,
        (SELECT count(*) FROM service_requests WHERE ${window()} AND ${bf()}) AS table_requests,
        (SELECT count(*) FROM branch_feedback WHERE ${window()} AND ${bf()}) AS reviews,
        (SELECT round(avg(rating)::numeric, 2) FROM branch_feedback WHERE ${window()} AND ${bf()}) AS rating`;

    const [cur, before, daily, heat, products, searches, branches, funnel, tiers, ratings, comments, requests] = await Promise.all([
      q(kpiSql),
      q(kpiSql, prev, since),
      q(`
        WITH d AS (SELECT generate_series(date_trunc('day', ${LOCAL('$1::timestamptz')}), date_trunc('day', ${LOCAL('$2::timestamptz')}), interval '1 day')::date AS day)
        SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
          (SELECT count(*) FROM analytics_events e WHERE e.event_type = 'page_view' AND ${window('e.created_at')} AND ${bf('e.branch_id')} AND ${LOCAL('e.created_at')}::date = d.day) AS views,
          (SELECT count(*) FROM loyalty_events l WHERE l.type = 'stamp' AND ${window('l.created_at')} AND ${bf('l.branch_id')} AND ${LOCAL('l.created_at')}::date = d.day) AS stamps
        FROM d ORDER BY d.day`),
      q(`
        SELECT extract(isodow FROM ${LOCAL('created_at')})::int AS dow, extract(hour FROM ${LOCAL('created_at')})::int AS hour, count(*) AS n
        FROM (
          SELECT created_at, branch_id FROM analytics_events WHERE event_type = 'page_view'
          UNION ALL SELECT created_at, branch_id FROM loyalty_events WHERE type = 'stamp'
        ) x WHERE ${window()} AND ${bf()} GROUP BY 1, 2`),
      q(`
        SELECT p.name, count(*) AS n FROM analytics_events e JOIN products p ON p.id = e.product_id
        WHERE e.${PRODUCT_VIEW} AND ${window('e.created_at')} AND ${bf('e.branch_id')}
        GROUP BY p.name ORDER BY n DESC LIMIT 10`),
      q(`
        SELECT lower(trim(search_query)) AS term, count(*) AS n FROM analytics_events
        WHERE event_type = 'search' AND search_query IS NOT NULL AND trim(search_query) <> '' AND ${window()} AND ${bf()}
        GROUP BY 1 ORDER BY n DESC LIMIT 10`),
      q(`
        SELECT b.id, b.name,
          (SELECT count(*) FROM analytics_events e WHERE e.branch_id = b.id AND e.event_type = 'page_view' AND ${window('e.created_at')}) AS views,
          (SELECT count(*) FROM loyalty_events l WHERE l.branch_id = b.id AND l.type = 'stamp' AND ${window('l.created_at')}) AS stamps,
          (SELECT count(*) FROM service_requests s WHERE s.branch_id = b.id AND ${window('s.created_at')}) AS requests,
          (SELECT round(avg(f.rating)::numeric, 1) FROM branch_feedback f WHERE f.branch_id = b.id AND ${window('f.created_at')}) AS rating
        FROM branches b WHERE b.status = 'active' AND ${bf('b.id')} ORDER BY views DESC, b.name`),
      // All-time loyalty journey: joined -> came back -> regular -> earned a reward.
      q(`
        WITH v AS (SELECT c.id, c.redeemed_count, (SELECT count(*) FROM loyalty_events e WHERE e.card_id = c.id AND e.type = 'stamp') AS visits FROM loyalty_cards c)
        SELECT count(*) AS members,
          count(*) FILTER (WHERE visits >= 1) AS stamped,
          count(*) FILTER (WHERE visits >= 2) AS returned,
          count(*) FILTER (WHERE visits >= 5) AS regulars,
          count(*) FILTER (WHERE redeemed_count >= 1) AS rewarded,
          (SELECT count(DISTINCT card_id) FROM loyalty_events WHERE type = 'stamp' AND ${window()} AND ${bf()}) AS active
        FROM v`),
      q(`
        WITH s AS (SELECT coalesce(silver_visits, 10) AS sv, coalesce(gold_visits, 30) AS gv FROM loyalty_settings WHERE id = 1
                   UNION ALL SELECT 10, 30 LIMIT 1),
        v AS (SELECT (SELECT count(*) FROM loyalty_events e WHERE e.card_id = c.id AND e.type = 'stamp' AND e.created_at >= now() - interval '365 days') AS visits FROM loyalty_cards c)
        SELECT count(*) FILTER (WHERE visits < (SELECT sv FROM s)) AS bronze,
          count(*) FILTER (WHERE visits >= (SELECT sv FROM s) AND visits < (SELECT gv FROM s)) AS silver,
          count(*) FILTER (WHERE visits >= (SELECT gv FROM s)) AS gold
        FROM v`),
      q(`SELECT rating, count(*) AS n FROM branch_feedback WHERE ${window()} AND ${bf()} GROUP BY rating ORDER BY rating`),
      q(`
        SELECT f.rating, f.comment, f.created_at, b.name AS branch FROM branch_feedback f LEFT JOIN branches b ON b.id = f.branch_id
        WHERE f.comment IS NOT NULL AND trim(f.comment) <> '' AND ${window('f.created_at')} AND ${bf('f.branch_id')}
        ORDER BY f.created_at DESC LIMIT 6`),
      q(`
        SELECT type, count(*) AS n,
          round(avg(extract(epoch FROM (done_at - created_at)) / 60) FILTER (WHERE done_at IS NOT NULL)::numeric, 1) AS avg_minutes
        FROM service_requests WHERE ${window()} AND ${bf()} GROUP BY type`),
    ]);

    const k = (r: Row) => ({
      views: n(r.views),
      product_views: n(r.product_views),
      searches: n(r.searches),
      stamps: n(r.stamps),
      redemptions: n(r.redemptions),
      new_members: n(r.new_members),
      table_requests: n(r.table_requests),
      reviews: n(r.reviews),
      rating: r.rating === null ? null : n(r.rating),
    });
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
    for (const h of heat) grid[n(h.dow) - 1][n(h.hour)] = n(h.n);
    const f = funnel[0] ?? {};

    return {
      days,
      branch_id: branch,
      kpis: { current: k(cur[0] ?? {}), previous: k(before[0] ?? {}) },
      daily: daily.map((d) => ({ day: String(d.day), views: n(d.views), stamps: n(d.stamps) })),
      busy: grid, // [Mon..Sun][0..23], Dubai time, menu views + stamps
      top_products: products.map((p) => ({ name: String(p.name), count: n(p.n) })),
      top_searches: searches.map((s) => ({ term: String(s.term), count: n(s.n) })),
      branches: branches.map((b) => ({
        id: String(b.id),
        name: String(b.name),
        views: n(b.views),
        stamps: n(b.stamps),
        requests: n(b.requests),
        rating: b.rating === null ? null : n(b.rating),
      })),
      loyalty_funnel: {
        members: n(f.members),
        stamped: n(f.stamped),
        returned: n(f.returned),
        regulars: n(f.regulars),
        rewarded: n(f.rewarded),
        active_in_period: n(f.active),
      },
      tiers: { bronze: n(tiers[0]?.bronze), silver: n(tiers[0]?.silver), gold: n(tiers[0]?.gold) },
      ratings: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: n(ratings.find((x) => n(x.rating) === r)?.n) })),
      recent_comments: comments.map((c) => ({ rating: n(c.rating), comment: String(c.comment), branch: c.branch ? String(c.branch) : null, created_at: c.created_at })),
      table_requests: ['staff', 'bill'].map((t) => {
        const r = requests.find((x) => x.type === t);
        return { type: t, count: n(r?.n), avg_minutes: r?.avg_minutes == null ? null : n(r.avg_minutes) };
      }),
    };
  }
}
