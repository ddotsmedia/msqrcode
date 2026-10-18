import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouponsService } from './coupons.service';

const P = '11111111-1111-1111-1111-111111111111';
const B1 = '22222222-2222-2222-2222-222222222222';
const B2 = '33333333-3333-3333-3333-333333333333';

function setup(opts: { promo?: any; row?: any } = {}) {
  const store: { row: any } = { row: opts.row ?? null };
  const promo = { id: P, title: 'Free cookie', is_active: true, coupon_enabled: true, branch_id: null, starts_on: null, ends_on: null, ...opts.promo };
  const coupons = {
    findOne: jest.fn(async ({ where }: any) => (where.code ? null : store.row)),
    find: jest.fn(async ({ where }: any) => (store.row && (!where.code || where.code === store.row.code) && (!where.card_id || where.card_id === store.row.card_id) ? [store.row] : [])),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => (store.row = x)),
  };
  const promos = { findOne: jest.fn(async () => promo) };
  const cards = { findOne: jest.fn(async ({ where }: any) => (where.token === 'tok' || where.id === 'card' ? { id: 'card', name: 'Sara', phone: '050' } : null)) };
  return { svc: new CouponsService(coupons as any, promos as any, cards as any), store };
}
const staff = { id: 'u', role: 'branch_manager', assigned_branch_id: B1 };

describe('CouponsService', () => {
  it('issues a 10-minute code for a card and reissues until used', async () => {
    const { svc, store } = setup();
    const a = await svc.issue({ promotion_id: P, token: 'tok' });
    expect(a.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(new Date(a.expires_at).getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
    const b = await svc.issue({ promotion_id: P, token: 'tok' });
    expect(store.row.code).toBe(b.code);
  });

  it('needs a rewards card and a coupon offer that is on', async () => {
    await expect(setup().svc.issue({ promotion_id: P, token: 'nope' })).rejects.toThrow('rewards');
    await expect(setup({ promo: { coupon_enabled: false } }).svc.issue({ promotion_id: P, token: 'tok' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup({ promo: { ends_on: '2020-01-01' } }).svc.issue({ promotion_id: P, token: 'tok' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('redeems once, by code or scanned QR, and refuses expired or used coupons', async () => {
    const { svc, store } = setup();
    const { code } = await svc.issue({ promotion_id: P, token: 'tok' });
    expect(await svc.redeem({ code: `MSQ-COUPON:${code.toLowerCase()}` }, staff)).toMatchObject({ ok: true, title: 'Free cookie', customer: 'Sara' });
    expect(store.row).toMatchObject({ redeemed_branch_id: B1 });
    await expect(svc.redeem({ code }, staff)).rejects.toThrow('already used');
    await expect(svc.issue({ promotion_id: P, token: 'tok' })).rejects.toThrow('already used');
    expect(await svc.used('tok')).toEqual([P]);

    const old = setup({ row: { promotion_id: P, card_id: 'card', code: 'ABCDEF', expires_at: new Date(Date.now() - 1000), redeemed_at: null } });
    await expect(old.svc.redeem({ code: 'ABCDEF' }, staff)).rejects.toThrow('expired');
    await expect(old.svc.redeem({ code: 'xx' }, staff)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps branch-only offers to their branch', async () => {
    const { svc } = setup({ promo: { branch_id: B2 } });
    const { code } = await svc.issue({ promotion_id: P, token: 'tok' });
    await expect(svc.redeem({ code }, staff)).rejects.toThrow('another branch');
  });
});
