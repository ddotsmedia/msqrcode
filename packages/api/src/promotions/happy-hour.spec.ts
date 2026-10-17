import { bestDiscount, discounted, isLive } from './happy-hour';

// Dubai is UTC+4: 2026-10-17 is a Saturday (day 6).
const at = (dubai: string) => new Date(`${dubai}+04:00`);
const hh = { title: '3-5 pm', discount_percent: 20, start_time: '15:00', end_time: '17:00', is_active: true };

describe('happy hour', () => {
  it('is live only inside the time window', () => {
    expect(isLive(hh, at('2026-10-17T14:59'))).toBe(false);
    expect(isLive(hh, at('2026-10-17T15:00'))).toBe(true);
    expect(isLive(hh, at('2026-10-17T16:59'))).toBe(true);
    expect(isLive(hh, at('2026-10-17T17:00'))).toBe(false);
  });

  it('respects weekdays, dates, the hidden switch and a missing discount', () => {
    expect(isLive({ ...hh, days: ['6'] }, at('2026-10-17T16:00'))).toBe(true);
    expect(isLive({ ...hh, days: ['0', '1'] }, at('2026-10-17T16:00'))).toBe(false);
    expect(isLive({ ...hh, starts_on: '2026-10-18' }, at('2026-10-17T16:00'))).toBe(false);
    expect(isLive({ ...hh, ends_on: '2026-10-16' }, at('2026-10-17T16:00'))).toBe(false);
    expect(isLive({ ...hh, is_active: false }, at('2026-10-17T16:00'))).toBe(false);
    expect(isLive({ ...hh, discount_percent: null }, at('2026-10-17T16:00'))).toBe(false);
    expect(isLive({ title: 'all day', discount_percent: 10 }, at('2026-10-17T03:00'))).toBe(true);
  });

  it('handles windows past midnight as part of the day they started', () => {
    const late = { ...hh, start_time: '22:00', end_time: '02:00', days: ['5'] }; // Friday night
    expect(isLive(late, at('2026-10-16T23:00'))).toBe(true); // Friday 23:00
    expect(isLive(late, at('2026-10-17T01:30'))).toBe(true); // Saturday 01:30, still Friday's window
    expect(isLive(late, at('2026-10-17T23:00'))).toBe(false); // Saturday night
  });

  it('picks the biggest live discount for the category', () => {
    const deals = [
      { ...hh, discount_percent: 15 },
      { ...hh, discount_percent: 30, category_ids: ['cakes'] },
    ];
    expect(bestDiscount(deals, 'coffee', at('2026-10-17T16:00'))).toEqual({ percent: 15, title: '3-5 pm', until: '17:00' });
    expect(bestDiscount(deals, 'cakes', at('2026-10-17T16:00'))?.percent).toBe(30);
    expect(bestDiscount(deals, 'cakes', at('2026-10-17T18:00'))).toBeNull();
    expect(discounted(18, 15)).toBe(15.3);
  });
});
