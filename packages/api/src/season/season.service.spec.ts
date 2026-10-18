import { BadRequestException } from '@nestjs/common';
import { ramadanActive, SeasonService } from './season.service';

const day = (offset: number) => new Date(Date.now() + 4 * 3600_000 + offset * 864e5).toISOString().slice(0, 10);
const CAT = '11111111-1111-1111-1111-111111111111';

function setup(row: any = null) {
  const store = { row };
  const settings = {
    findOne: jest.fn(async () => store.row),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => (store.row = { ...x })),
  };
  return { svc: new SeasonService(settings as any), settings };
}

const on = { ramadan_enabled: true, ramadan_starts_on: day(-3), ramadan_ends_on: day(10), greeting: 'Ramadan Kareem', note: 'Open 7pm–2am', featured_category_ids: [CAT] };

describe('Ramadan mode', () => {
  it('is active only when switched on and today is within the dates', () => {
    expect(ramadanActive(on)).toBe(true);
    expect(ramadanActive({ ...on, ramadan_enabled: false })).toBe(false);
    expect(ramadanActive({ ...on, ramadan_starts_on: day(1) })).toBe(false);
    expect(ramadanActive({ ...on, ramadan_ends_on: day(-1) })).toBe(false);
    expect(ramadanActive({ ...on, ramadan_ends_on: day(0) })).toBe(true);
    expect(ramadanActive(null)).toBe(false);
  });

  it('tells the site what to show', async () => {
    expect(await setup(on).svc.publicSeason()).toEqual({ ramadan: { greeting: 'Ramadan Kareem', note: 'Open 7pm–2am', ends_on: on.ramadan_ends_on, featured_category_ids: [CAT] } });
    expect(await setup({ ...on, ramadan_enabled: false }).svc.publicSeason()).toEqual({ ramadan: null });
    expect(await setup(null).svc.publicSeason()).toEqual({ ramadan: null });
  });

  it('swaps in Ramadan hours only when they are set and Ramadan is on', async () => {
    const reg = { Monday: { open: '07:00', close: '23:00' } };
    const ram = { Monday: { open: '19:00', close: '02:00' } };
    const b: any = { id: 'b', operating_hours: reg, ramadan_hours: ram };
    expect(await setup(on).svc.applyToBranch(b)).toMatchObject({ operating_hours: ram, ramadan: true });
    expect((await setup(on).svc.applyToBranch({ ...b, ramadan_hours: null })).operating_hours).toBe(reg);
    expect((await setup({ ...on, ramadan_enabled: false }).svc.applyToBranch(b)).operating_hours).toBe(reg);
  });

  it('validates and saves the settings', async () => {
    const { svc } = setup(null);
    const res = await svc.update({ ramadan_enabled: true, ramadan_starts_on: day(-1), ramadan_ends_on: day(28), greeting: '  ', note: 'Iftar boxes', featured_category_ids: [CAT, 'x', CAT] });
    expect(res).toMatchObject({ active: true, greeting: 'Ramadan Kareem', note: 'Iftar boxes', featured_category_ids: [CAT] });
    await expect(setup(null).svc.update({ ramadan_enabled: true })).rejects.toThrow('first and last day');
    await expect(setup(null).svc.update({ ramadan_starts_on: day(5), ramadan_ends_on: day(1) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup(null).svc.update({ ramadan_starts_on: '2026/01/01' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
