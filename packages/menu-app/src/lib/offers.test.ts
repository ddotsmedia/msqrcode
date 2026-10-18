// Run: node --experimental-strip-types src/lib/offers.test.ts
import { countdown, daysLeft, icsFor, liveNow, timing, weekGrid, whenLabel, type Offer } from './offers.ts';

const check = (ok: boolean, what: string) => {
  if (!ok) throw new Error(`Failed: ${what}`);
};
// Dubai wall-clock time -> Date. 2026-10-18 is a Sunday.
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00+04:00`);

const happy: Offer = { id: 'h', title: 'Happy hour', discount_percent: 20, start_time: '15:00', end_time: '17:00', days: ['0', '1'] };
const late: Offer = { id: 'l', title: 'Late', discount_percent: 10, start_time: '22:00', end_time: '02:00' };
const dated: Offer = { id: 'd', title: 'Dated', discount_percent: null, starts_on: '2026-10-10', ends_on: '2026-10-20' };

let t = timing(happy, at('2026-10-18', '16:00'));
check(t.live && t.until?.getTime() === at('2026-10-18', '17:00').getTime(), 'live until 17:00 on Sunday');
t = timing(happy, at('2026-10-18', '18:00'));
check(!t.live && t.next?.getTime() === at('2026-10-19', '15:00').getTime(), 'next is Monday 15:00');
t = timing(happy, at('2026-10-20', '10:00'));
check(t.next?.getTime() === at('2026-10-25', '15:00').getTime(), 'skips to next Sunday');
t = timing(late, at('2026-10-19', '01:00'));
check(t.live && t.until?.getTime() === at('2026-10-19', '02:00').getTime(), 'overnight window still live after midnight');
check(!timing(dated).live && !timing(dated).next, 'dated offers have no timing');

check(liveNow(dated, at('2026-10-18', '09:00')) && !liveNow(dated, at('2026-10-21', '09:00')), 'dated offer live inside its dates');
check(daysLeft(dated, at('2026-10-18', '23:00')) === 2, 'two days left');
check(countdown(3_909_000) === '1:05:09' && countdown(65_000) === '1:05', 'countdown text');
check(whenLabel(at('2026-10-19', '15:00'), at('2026-10-18', '20:00')) === 'Tomorrow 15:00', 'tomorrow label');
check(whenLabel(at('2026-10-21', '15:00'), at('2026-10-18', '20:00')) === 'Wed 15:00', 'weekday label');

const grid = weekGrid([happy, late, dated]);
check(grid[0].length === 3 && grid[2].length === 2 && grid[1].some((s) => s.offer.id === 'h'), 'weekly grid rows');
check(grid[1].some((s) => s.offer.id === 'l' && s.from === 0 && s.to === 120), 'overnight part lands on next day');

const ics = icsFor(happy, 'https://coffeesales.ae/offers', at('2026-10-18', '18:00'));
check(ics.includes('RRULE:FREQ=WEEKLY;BYDAY=SU,MO') && ics.includes('DTSTART:20261019T110000Z'), 'weekly calendar event');
const icsDated = icsFor(dated, 'https://coffeesales.ae/offers');
check(icsDated.includes('DTSTART;VALUE=DATE:20261010') && icsDated.includes('DTEND;VALUE=DATE:20261021'), 'all-day calendar span');

console.log('✅ All offers tests passed');
