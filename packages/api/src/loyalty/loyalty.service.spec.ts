import { BadRequestException } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';

// In-memory stand-ins for the TypeORM repositories the service uses.
function setup(opts: { stamps?: number; lastStampMsAgo?: number; target?: number } = {}) {
  const card = { id: 'c1', phone: '971501234567', name: 'Test', token: 't', stamps: opts.stamps ?? 0, redeemed_count: 0 };
  const saved: any[] = [];
  const cards = { findOne: jest.fn(async () => card), save: jest.fn(async (c: any) => c) };
  const events = {
    create: jest.fn((e: any) => e),
    save: jest.fn(async (e: any) => {
      saved.push(e);
      return e;
    }),
    findOne: jest.fn(async () =>
      opts.lastStampMsAgo === undefined ? null : { created_at: new Date(Date.now() - opts.lastStampMsAgo) },
    ),
  };
  const settings = {
    findOne: jest.fn(async () => (opts.target ? { id: 1, stamps_target: opts.target, reward_name: 'Free drink' } : null)),
    save: jest.fn(async (s: any) => s),
  };
  const svc = new LoyaltyService(cards as any, events as any, settings as any, {} as any, {} as any);
  return { svc, card, saved, settings };
}

describe('LoyaltyService', () => {
  it('adds a stamp and logs it with the staff user', async () => {
    const { svc, card, saved } = setup({ stamps: 2 });
    const res = await svc.addStamp({ phone: card.phone }, { id: 'u1', role: 'admin', assigned_branch_id: 'b1' });
    expect(res).toEqual({ ok: true, stamps: 3 });
    expect(saved[0]).toMatchObject({ type: 'stamp', delta: 1, stamps_after: 3, staff_user_id: 'u1', branch_id: 'b1' });
  });

  it('blocks a second stamp within a minute', async () => {
    const { svc, card, saved } = setup({ stamps: 2, lastStampMsAgo: 10_000 });
    const res = await svc.addStamp({ phone: card.phone });
    expect(res.ok).toBe(false);
    expect(card.stamps).toBe(2);
    expect(saved).toHaveLength(0);
  });

  it('allows a stamp after the cooldown', async () => {
    const { svc, card } = setup({ stamps: 2, lastStampMsAgo: 61_000 });
    expect((await svc.addStamp({ phone: card.phone })).ok).toBe(true);
  });

  it('uses the saved stamps target', async () => {
    const { svc, card } = setup({ stamps: 8, target: 8 });
    expect((await svc.addStamp({ phone: card.phone })).ok).toBe(false);
    expect((await svc.redeem({ phone: card.phone })).ok).toBe(true);
  });

  it('clamps adjustments to 0..target and logs the applied change', async () => {
    const { svc, card, saved } = setup({ stamps: 9 });
    const res = await svc.adjust({ phone: card.phone, delta: 5, note: 'Missed stamps on Monday' });
    expect(res).toEqual({ ok: true, stamps: 10 });
    expect(saved[0]).toMatchObject({ type: 'adjust', delta: 1, note: 'Missed stamps on Monday' });
  });

  it('rejects an adjustment without a reason or with zero', async () => {
    const { svc, card } = setup();
    await expect(svc.adjust({ phone: card.phone, delta: 2, note: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.adjust({ phone: card.phone, delta: 0, note: 'reason' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates settings', async () => {
    const { svc } = setup();
    await expect(svc.updateSettings({ stamps_target: 2, reward_name: 'Coffee' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateSettings({ stamps_target: 12, reward_name: '' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
