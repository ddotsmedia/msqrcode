import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { COUNTER_WINDOW_MS, LoyaltyService, counterCode, dubaiNow, isDoubleNow, nearBirthday, parseBirthday, tierFor, weekStart, type Rules } from './loyalty.service';

process.env.JWT_SECRET = 'test-secret';

type Opts = {
  stamps?: number;
  lastStampMsAgo?: number;
  stampsToday?: number;
  settings?: Record<string, unknown>;
  card?: Record<string, unknown>;
  referrer?: Record<string, unknown>;
  count?: (where: any) => number;
};

// In-memory stand-ins for the TypeORM repositories the service uses.
function setup(opts: Opts = {}) {
  const card: any = { id: 'c1', phone: '971501234567', name: 'Test', token: 't', stamps: opts.stamps ?? 0, redeemed_count: 0, referral_rewarded: false, ...opts.card };
  const referrer: any = opts.referrer ? { id: 'r1', stamps: 0, redeemed_count: 0, ...opts.referrer } : null;
  const saved: any[] = [];
  const cards = {
    findOne: jest.fn(async ({ where }: any) => {
      if (where.id && referrer && where.id === referrer.id) return referrer;
      if (where.referral_code) return null;
      return card;
    }),
    save: jest.fn(async (c: any) => c),
  };
  const events = {
    create: jest.fn((e: any) => e),
    save: jest.fn(async (e: any) => {
      saved.push(e);
      return e;
    }),
    findOne: jest.fn(async () => (opts.lastStampMsAgo === undefined ? null : { created_at: new Date(Date.now() - opts.lastStampMsAgo) })),
    count: jest.fn(async ({ where }: any) => (opts.count ? opts.count(where) : (opts.stampsToday ?? 0))),
  };
  const settings = {
    findOne: jest.fn(async () => (opts.settings ? { id: 1, stamps_target: 10, reward_name: 'Free drink', ...opts.settings } : null)),
    save: jest.fn(async (s: any) => s),
  };
  const branches = {
    findOne: jest.fn(async ({ where }: any) => (where.id === 'b1b1b1b1' ? { id: 'b1b1b1b1', name: 'Khalidiya', status: 'active' } : null)),
  };
  const svc = new LoyaltyService(cards as any, events as any, settings as any, {} as any, branches as any);
  return { svc, card, referrer, saved };
}

const allDays = { double_days: '0,1,2,3,4,5,6', double_from: '00:00', double_to: '23:59' };

describe('LoyaltyService', () => {
  it('adds a stamp and logs it with the staff user', async () => {
    const { svc, card, saved } = setup({ stamps: 2 });
    const res = await svc.addStamp({ phone: card.phone }, { id: 'u1', role: 'admin', assigned_branch_id: 'b1' });
    expect(res).toMatchObject({ ok: true, stamps: 3, earned: 1, double: false });
    expect(saved[0]).toMatchObject({ type: 'stamp', delta: 1, stamps_after: 3, staff_user_id: 'u1', branch_id: 'b1' });
  });

  it('finds a card by the token in its QR code', async () => {
    const { svc } = setup({ stamps: 0 });
    expect((await svc.addStamp({ token: 't' })).ok).toBe(true);
  });

  it('blocks a second stamp within a minute', async () => {
    const { svc, card, saved } = setup({ stamps: 2, lastStampMsAgo: 10_000 });
    expect((await svc.addStamp({ phone: card.phone })).ok).toBe(false);
    expect(card.stamps).toBe(2);
    expect(saved).toHaveLength(0);
  });

  it('enforces the daily stamp limit', async () => {
    const { svc, card } = setup({ stamps: 2, stampsToday: 3, settings: { daily_stamp_limit: 3 } });
    const res = await svc.addStamp({ phone: card.phone });
    expect(res).toMatchObject({ ok: false, message: expect.stringContaining('Daily limit') });
  });

  it('gives two stamps during double-stamp hours, capped at the target', async () => {
    const { svc, card } = setup({ stamps: 9, settings: allDays });
    const res = await svc.addStamp({ phone: card.phone });
    expect(res).toMatchObject({ ok: true, stamps: 10, earned: 1, double: true });
  });

  it('gives the birthday bonus once a year in the birthday week', async () => {
    const today = dubaiNow().md;
    const { svc, card, saved } = setup({ stamps: 0, card: { birthday: today } });
    const res = await svc.addStamp({ phone: card.phone });
    expect(res).toMatchObject({ ok: true, stamps: 2, bonuses: ['birthday'] });
    expect(saved.map((e) => e.type)).toEqual(['stamp', 'bonus']);
    expect(card.birthday_rewarded_year).toBe(dubaiNow().year);
  });

  it('does not repeat the birthday bonus in the same year', async () => {
    const { svc, card } = setup({ stamps: 0, card: { birthday: dubaiNow().md, birthday_rewarded_year: dubaiNow().year } });
    expect(await svc.addStamp({ phone: card.phone })).toMatchObject({ stamps: 1, bonuses: [] });
  });

  it('rewards both friends once after a referred customer is first stamped', async () => {
    const { svc, card, referrer } = setup({ stamps: 0, card: { referred_by: 'r1' }, referrer: { stamps: 4 } });
    const res = await svc.addStamp({ phone: card.phone });
    expect(res).toMatchObject({ ok: true, stamps: 2, bonuses: ['referral'] });
    expect(referrer.stamps).toBe(5);
    expect(card.referral_rewarded).toBe(true);
  });

  it('uses the saved stamps target', async () => {
    const { svc, card } = setup({ stamps: 8, settings: { stamps_target: 8 } });
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
    await expect(svc.updateSettings({ stamps_target: 2 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateSettings({ reward_name: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateSettings({ double_days: [7] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateSettings({ double_from: '17:00', double_to: '14:00' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('tiers and weekly challenge', () => {
  it('gives the challenge bonus once when the weekly target is reached', async () => {
    // 3rd stamp this week, no challenge bonus yet
    const { svc, saved } = setup({ settings: { challenge_visits: 3, challenge_bonus: 2, daily_stamp_limit: 10 }, count: (w) => (w.type === 'stamp' ? 3 : 0) });
    const res = await svc.addStamp({ token: 't' });
    expect(res).toMatchObject({ ok: true, stamps: 3, bonuses: ['challenge'] });
    expect(saved[1]).toMatchObject({ type: 'bonus', delta: 2, note: 'Weekly challenge' });
  });

  it('does not repeat the challenge bonus in the same week', async () => {
    const { svc } = setup({ settings: { challenge_visits: 3, daily_stamp_limit: 10 }, count: (w) => (w.type === 'stamp' ? 4 : 1) });
    expect(await svc.addStamp({ token: 't' })).toMatchObject({ ok: true, bonuses: [] });
  });

  it('reports the tier and perk with each stamp', async () => {
    const { svc } = setup({ settings: { gold_perk: 'Free size upgrade', daily_stamp_limit: 50 }, count: (w) => (w.type === 'stamp' ? 31 : 0) });
    expect(await svc.addStamp({ token: 't' })).toMatchObject({ tier: 'gold', tier_perk: 'Free size upgrade' });
  });

  it('works out tiers from yearly visits', () => {
    const r = { silver_visits: 10, gold_visits: 30 };
    expect([tierFor(0, r), tierFor(10, r), tierFor(29, r), tierFor(30, r)]).toEqual(['bronze', 'silver', 'silver', 'gold']);
  });

  it('starts the week on Monday in Dubai time', () => {
    // Sunday 2026-10-18 21:00 UTC = Monday 01:00 in Dubai -> week starts Monday 00:00 Dubai = Sunday 20:00 UTC
    expect(weekStart(Date.UTC(2026, 9, 18, 21, 0)).toISOString()).toBe('2026-10-18T20:00:00.000Z');
    // Sunday 2026-10-18 10:00 UTC = Sunday 14:00 Dubai -> previous Monday 00:00 Dubai
    expect(weekStart(Date.UTC(2026, 9, 18, 10, 0)).toISOString()).toBe('2026-10-11T20:00:00.000Z');
  });

  it('validates tier and challenge settings', async () => {
    const { svc } = setup();
    await expect(svc.updateSettings({ silver_visits: 20, gold_visits: 20 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateSettings({ challenge_visits: 8 })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('counter self-stamp', () => {
  const code = (offset = 0) => `b1b1b1b1.${counterCode('test-secret', 'b1b1b1b1', Math.floor(Date.now() / COUNTER_WINDOW_MS) + offset)}`;
  const on = { settings: { self_stamp: true } };

  it('stamps with the current or previous code and records the branch', async () => {
    const { svc, saved } = setup(on);
    const res = await svc.selfStamp({ token: 't', code: code() });
    expect(res).toMatchObject({ ok: true, stamps: 1, branch_name: 'Khalidiya' });
    expect(res).not.toHaveProperty('phone');
    expect(saved[0]).toMatchObject({ type: 'stamp', branch_id: 'b1b1b1b1', staff_user_id: null, note: 'Self-stamp at counter' });
    expect((await setup(on).svc.selfStamp({ token: 't', code: code(-1) })).ok).toBe(true);
  });

  it('rejects an old, wrong or foreign code', async () => {
    const { svc, card } = setup(on);
    expect((await svc.selfStamp({ token: 't', code: code(-2) })).ok).toBe(false);
    expect((await svc.selfStamp({ token: 't', code: 'b1b1b1b1.AAAAAAAA' })).ok).toBe(false);
    expect((await svc.selfStamp({ token: 't', code: `cccccccc.${code().split('.')[1]}` })).ok).toBe(false);
    expect(card.stamps).toBe(0);
  });

  it('does nothing while switched off', async () => {
    const { svc, card } = setup();
    expect(await svc.selfStamp({ token: 't', code: code() })).toMatchObject({ ok: false });
    expect(card.stamps).toBe(0);
  });

  it('keeps branch managers to their own branch', async () => {
    const { svc } = setup(on);
    await expect(svc.counter('b1b1b1b1', { id: 'u', role: 'branch_manager', assigned_branch_id: 'b2b2b2b2' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(await svc.counter('b1b1b1b1', { id: 'u', role: 'admin' })).toMatchObject({ code: code(), branch_name: 'Khalidiya' });
  });
});

describe('loyalty helpers', () => {
  const rules: Rules = { stamps_target: 10, reward_name: 'x', daily_stamp_limit: 3, birthday_bonus: 1, referral_bonus: 1, double_days: [1], double_from: '14:00', double_to: '17:00', self_stamp: false, silver_visits: 10, gold_visits: 30, silver_perk: '', gold_perk: '', challenge_visits: 0, challenge_bonus: 1 };

  it('checks double-stamp hours in Dubai time', () => {
    // Monday 2026-10-12 11:00 UTC = 15:00 in Dubai
    expect(isDoubleNow(rules, Date.UTC(2026, 9, 12, 11, 0))).toBe(true);
    // Monday 2026-10-12 14:00 UTC = 18:00 in Dubai
    expect(isDoubleNow(rules, Date.UTC(2026, 9, 12, 14, 0))).toBe(false);
  });

  it('matches the birthday week across the new year', () => {
    expect(nearBirthday('12-30', '01-01')).toBe(true);
    expect(nearBirthday('06-10', '06-20')).toBe(false);
  });

  it('parses birthdays and keeps only month and day', () => {
    expect(parseBirthday('1990-04-15')).toBe('04-15');
    expect(parseBirthday('02-29')).toBe('02-29');
    expect(parseBirthday('')).toBeNull();
    expect(() => parseBirthday('2020-02-30')).toThrow(BadRequestException);
  });
});
