import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { nextStart } from './starts-soon';

const P = '11111111-1111-1111-1111-111111111111';
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00+04:00`); // 2026-10-18 is a Sunday
const happy = { id: P, title: 'Coffee hour', is_active: true, discount_percent: 20, start_time: '15:00', end_time: '17:00', days: ['0', '1'] };

function setup(rows: any[] = []) {
  const store = [...rows];
  const reminders = {
    find: jest.fn(async ({ where }: any) => store.filter((r) => (where.card_id ? r.card_id === where.card_id : true))),
    findOne: jest.fn(async ({ where }: any) => store.find((r) => r.promotion_id === where.promotion_id && r.card_id === where.card_id) ?? null),
    count: jest.fn(async () => store.length),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => (store.includes(x) ? x : (store.push(x), x))),
    delete: jest.fn(async () => store.splice(0, store.length)),
  };
  const promos = { findOne: jest.fn(async () => happy), find: jest.fn(async () => [happy]) };
  const cards = { findOne: jest.fn(async ({ where }: any) => (where.token === 'tok' ? { id: 'card' } : null)) };
  const push = { sendToCard: jest.fn(async () => undefined) };
  return { svc: new RemindersService(reminders as any, promos as any, cards as any, push as any), store, push };
}

describe('happy hour reminders', () => {
  it('finds the next start on an allowed day', () => {
    expect(nextStart(happy, at('2026-10-18', '14:00'))?.getTime()).toBe(at('2026-10-18', '15:00').getTime());
    expect(nextStart(happy, at('2026-10-18', '16:00'))?.getTime()).toBe(at('2026-10-19', '15:00').getTime());
    expect(nextStart(happy, at('2026-10-20', '10:00'))).toBeNull(); // next is Sunday, more than two days away
    expect(nextStart({ ...happy, start_time: null })).toBeNull();
  });

  it('turns a reminder on and off for a rewards card', async () => {
    const { svc, store } = setup();
    expect(await svc.set({ token: 'tok', promotion_id: P })).toEqual({ on: true });
    expect(await svc.list('tok')).toEqual([P]);
    expect(await svc.set({ token: 'tok', promotion_id: P, on: false })).toEqual({ on: false });
    expect(store).toHaveLength(0);
    await expect(svc.set({ token: 'nope', promotion_id: P })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.set({ token: 'tok', promotion_id: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('notifies 15 minutes before the start, once', async () => {
    const { svc, push } = setup([{ promotion_id: P, card_id: 'card', last_sent_at: null }]);
    expect(await svc.tick(at('2026-10-18', '14:30'))).toBe(0);
    expect(await svc.tick(at('2026-10-18', '14:45'))).toBe(1);
    expect(push.sendToCard).toHaveBeenCalledWith('card', expect.objectContaining({ title: 'Coffee hour starts in 15 minutes', url: '/offers' }));
    expect(await svc.tick(at('2026-10-18', '14:45'))).toBe(0);
  });
});
