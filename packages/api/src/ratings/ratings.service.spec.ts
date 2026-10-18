import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RatingsService } from './ratings.service';

const O1 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const P1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function setup(order: any = null, existing: any = null, raw: any[] = []) {
  const saved: any[] = [];
  const orders = { findOne: jest.fn(async () => order) };
  const qb: any = { select: () => qb, addSelect: () => qb, where: () => qb, groupBy: () => qb, getRawMany: jest.fn(async () => raw) };
  const ratings = {
    findOne: jest.fn(async () => existing),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => (saved.push(x), x)),
    createQueryBuilder: jest.fn(() => qb),
  };
  return { svc: new RatingsService(orders as any, ratings as any), saved, qb };
}
const done = { id: O1, access_token: 't', status: 'completed', created_at: new Date(), items: [{ product_id: P1 }] };

describe('RatingsService', () => {
  it('saves a vote for an item of a collected order, and replaces a second vote', async () => {
    const a = setup(done);
    expect(await a.svc.rate(O1, { token: 't', product_id: P1, up: true })).toEqual({ ok: true });
    expect(a.saved[0]).toMatchObject({ order_id: O1, product_id: P1, up: true });
    const b = setup(done, { id: 'r1', order_id: O1, product_id: P1, up: true });
    await b.svc.rate(O1, { token: 't', product_id: P1, up: false });
    expect(b.saved[0]).toMatchObject({ id: 'r1', up: false });
  });

  it('refuses wrong tokens, open or old orders and other items', async () => {
    await expect(setup(done).svc.rate(O1, { token: 'x', product_id: P1, up: true })).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup({ ...done, status: 'ready' }).svc.rate(O1, { token: 't', product_id: P1, up: true })).rejects.toThrow('collected');
    await expect(setup({ ...done, created_at: new Date(Date.now() - 8 * 864e5) }).svc.rate(O1, { token: 't', product_id: P1, up: true })).rejects.toThrow('too old');
    await expect(setup(done).svc.rate(O1, { token: 't', product_id: 'other', up: true })).rejects.toThrow('not in this order');
    await expect(setup(done).svc.rate(O1, { token: 't', product_id: P1, up: 'yes' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists items with enough mostly-positive votes, best first', async () => {
    const raw = [
      { product_id: 'a', votes: '10', ups: '9' },
      { product_id: 'b', votes: '4', ups: '4' },
      { product_id: 'c', votes: '10', ups: '6' },
      { product_id: 'd', votes: '6', ups: '6' },
    ];
    const { svc, qb } = setup(null, null, raw);
    expect(await svc.loved()).toEqual([
      { product_id: 'd', votes: 6, percent: 100 },
      { product_id: 'a', votes: 10, percent: 90 },
    ]);
    await svc.loved();
    expect(qb.getRawMany).toHaveBeenCalledTimes(1); // cached
  });
});
