import { BadRequestException } from '@nestjs/common';
import { SalesService } from './sales.service';
import { MenuService } from './menu.service';
import { CustomersService } from './customers.service';

const BRANCH = '11111111-1111-1111-1111-111111111111';

// Each test routes db.query by the SQL text, so the service's own queries are exercised
// without a database. The SQL itself was checked separately against Postgres.
function db(route: (sql: string, call: number) => any) {
  let n = 0;
  return { query: jest.fn(async (sql: string) => route(sql, n++)) };
}

describe('SalesService', () => {
  it('computes average order value and passes through the splits', async () => {
    const svc = new SalesService(
      db((sql, call) => {
        if (sql.includes('AS completed')) {
          // call 0 = current period, call 1 = previous period
          return [call === 0 ? { completed: 4, cancelled: 1, open: 0, revenue: 200 } : { completed: 2, cancelled: 0, open: 0, revenue: 80 }];
        }
        if (sql.includes('to_char')) return [{ day: '2026-10-24', orders: 4, revenue: 200 }];
        if (sql.includes('JOIN branches')) return [{ id: BRANCH, name: 'Main', orders: 4, revenue: 200 }];
        return [{ type: 'pickup', orders: 4, revenue: 200 }];
      }) as any,
    );
    const r = await svc.sales(30, undefined);
    expect(r.kpis.current.revenue).toBe(200);
    expect(r.kpis.current.average_order_value).toBe(50);
    expect(r.kpis.previous.average_order_value).toBe(40);
    expect(r.kpis.current.cancelled).toBe(1);
    expect(r.branches[0].name).toBe('Main');
    expect(r.types[0].type).toBe('pickup');
  });

  it('returns zero average order value when nothing completed', async () => {
    const svc = new SalesService(
      db((sql) => (sql.includes('AS completed') ? [{ completed: 0, cancelled: 0, open: 0, revenue: 0 }] : [])) as any,
    );
    const r = await svc.sales(7, undefined);
    expect(r.kpis.current.average_order_value).toBe(0);
    expect(r.days).toBe(7);
  });

  it('rejects a malformed branch id and falls back to 30 days for an unknown period', async () => {
    const svc = new SalesService(
      db((sql) => (sql.includes('AS completed') ? [{ completed: 0, cancelled: 0, open: 0, revenue: 0 }] : [])) as any,
    );
    await expect(svc.sales(30, 'not-a-uuid')).rejects.toBeInstanceOf(BadRequestException);
    const r = await svc.sales(999, undefined);
    expect(r.days).toBe(30);
  });
});

describe('MenuService', () => {
  it('sorts top and lowest sellers and computes category shares', async () => {
    const items = [
      { key: 'a', name: 'Latte', units: 10, revenue: 100 },
      { key: 'b', name: 'Cake', units: 4, revenue: 80 },
      { key: 'c', name: 'Tea', units: 1, revenue: 5 },
    ];
    const categories = [
      { category: 'Coffee', units: 11, revenue: 105 },
      { category: 'Cake', units: 4, revenue: 80 },
    ];
    const svc = new MenuService(
      db((sql) => {
        if (sql.includes('GROUP BY 1, 2')) return items;
        if (sql.includes('COALESCE(c.name')) return categories;
        return [{ units: 15, revenue: 185 }];
      }) as any,
    );
    const r = await svc.menu(30, undefined);
    expect(r.top_sellers[0].name).toBe('Latte');
    expect(r.bottom_sellers[0].name).toBe('Tea');
    expect(r.totals.items_sold).toBe(3);
    const coffee = r.categories.find((c: { name: string }) => c.name === 'Coffee')!;
    expect(coffee.share).toBeCloseTo(105 / 185);
  });

  it('gives zero shares when there are no sales', async () => {
    const svc = new MenuService(db((sql) => (sql.includes('COALESCE(SUM(oi.qty)') && !sql.includes('GROUP') ? [{ units: 0, revenue: 0 }] : [])) as any);
    const r = await svc.menu(30, undefined);
    expect(r.categories).toEqual([]);
    expect(r.totals.revenue).toBe(0);
  });
});

describe('CustomersService', () => {
  it('computes repeat rate, returning-customer averages and card share', async () => {
    const svc = new CustomersService(
      db((sql, call) =>
        // call 0 = current period, call 1 = previous period
        [
          call === 0
            ? { customers: 4, returning: 2, avg_orders_returning: 2.5, card_orders: 10, completed_orders: 20 }
            : { customers: 2, returning: 1, avg_orders_returning: 2, card_orders: 4, completed_orders: 8 },
        ],
      ) as any,
    );
    const r = await svc.customers(30, undefined);
    expect(r.kpis.current.repeat_rate).toBeCloseTo(0.5);
    expect(r.kpis.current.card_share).toBeCloseTo(0.5);
    expect(r.kpis.previous.repeat_rate).toBeCloseTo(0.5);
  });

  it('avoids dividing by zero when there are no card customers', async () => {
    const svc = new CustomersService(
      db(() => [{ customers: 0, returning: 0, avg_orders_returning: 0, card_orders: 0, completed_orders: 0 }]) as any,
    );
    const r = await svc.customers(7, undefined);
    expect(r.kpis.current.repeat_rate).toBe(0);
    expect(r.kpis.current.card_share).toBe(0);
  });
});
