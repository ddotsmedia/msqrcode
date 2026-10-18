import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { LoyaltyCard } from '../entities/loyalty-card.entity';
import { LoyaltyEvent, LoyaltyEventType } from '../entities/loyalty-event.entity';
import { LoyaltySettings } from '../entities/loyalty-settings.entity';
import { User } from '../entities/user.entity';
import { Branch } from '../entities/branch.entity';
import { PushService } from '../push/push.service';

// Defaults used until an admin saves the settings.
export const STAMPS_TARGET = 10;
const DEFAULTS = {
  stamps_target: STAMPS_TARGET,
  reward_name: 'Free drink',
  daily_stamp_limit: 3,
  birthday_bonus: 1,
  referral_bonus: 1,
  double_days: [] as number[],
  double_from: '14:00',
  double_to: '17:00',
  self_stamp: false,
  silver_visits: 10,
  gold_visits: 30,
  silver_perk: '',
  gold_perk: '',
  challenge_visits: 0,
  challenge_bonus: 1,
};
export type Rules = typeof DEFAULTS;

// Blocks an accidental second stamp from a double tap or two staff members at once.
const STAMP_COOLDOWN_MS = 60_000;
// Days either side of the birthday that count as the birthday week.
const BIRTHDAY_WINDOW_DAYS = 3;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// The counter code changes every 30 seconds; the previous code is still accepted, so each lasts up to a minute.
export const COUNTER_WINDOW_MS = 30_000;
const BRANCH_ID = /^[a-f0-9-]{8,64}$/i;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// UAE has no daylight saving, so Asia/Dubai is always UTC+4.
const DUBAI_OFFSET_MS = 4 * 3600_000;
export function dubaiNow(ms = Date.now()) {
  const d = new Date(ms + DUBAI_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    year: d.getUTCFullYear(),
    md: `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    hm: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
    weekday: d.getUTCDay(),
    dayStart: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - DUBAI_OFFSET_MS),
  };
}

// Start of the current Monday-to-Sunday week in Dubai.
export function weekStart(ms = Date.now()) {
  const d = new Date(ms + DUBAI_OFFSET_MS);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back) - DUBAI_OFFSET_MS);
}

export type Tier = 'bronze' | 'silver' | 'gold';
export function tierFor(visits: number, rules: Pick<Rules, 'silver_visits' | 'gold_visits'>): Tier {
  if (visits >= rules.gold_visits) return 'gold';
  if (visits >= rules.silver_visits) return 'silver';
  return 'bronze';
}

const CHALLENGE_NOTE = 'Weekly challenge';

export function isDoubleNow(rules: Rules, ms = Date.now()) {
  const now = dubaiNow(ms);
  return rules.double_days.includes(now.weekday) && now.hm >= rules.double_from && now.hm < rules.double_to;
}

// True when today (MM-DD) is within the birthday window, wrapping around the new year.
export function nearBirthday(birthday: string, todayMd: string) {
  const day = (md: string) => {
    const [m, d] = md.split('-').map(Number);
    return Math.round((Date.UTC(2024, m - 1, d) - Date.UTC(2024, 0, 1)) / 864e5);
  };
  const diff = Math.abs(day(birthday) - day(todayMd));
  return Math.min(diff, 366 - diff) <= BIRTHDAY_WINDOW_DAYS;
}

// Accepts YYYY-MM-DD (date input) or MM-DD; keeps MM-DD only.
export function parseBirthday(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const m = raw.trim().match(/^(?:\d{4}-)?(\d{2})-(\d{2})$/);
  if (!m) throw new BadRequestException('Enter a valid birthday');
  const month = Number(m[1]);
  const day = Number(m[2]);
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (!max || day < 1 || day > max) throw new BadRequestException('Enter a valid birthday');
  return `${m[1]}-${m[2]}`;
}

// 8-character code for one branch and one 30-second window, signed with the server secret.
export function counterCode(secret: string, branchId: string, window: number) {
  const h = createHmac('sha256', secret).update(`counter:${branchId}:${window}`).digest();
  return Array.from(h.subarray(0, 8), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

function counterSecret() {
  const s = process.env.LOYALTY_COUNTER_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

export interface StaffUser {
  id: string | null;
  role: string;
  assigned_branch_id?: string | null;
}

type CardRef = { phone?: unknown; token?: unknown };

@Injectable()
export class LoyaltyService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(LoyaltyCard) private cards: Repository<LoyaltyCard>,
    @InjectRepository(LoyaltyEvent) private events: Repository<LoyaltyEvent>,
    @InjectRepository(LoyaltySettings) private settingsRepo: Repository<LoyaltySettings>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Branch) private branches: Repository<Branch>,
    @Optional() private push?: PushService,
  ) {}

  // Every 10 minutes: announce double-stamp hours once a day when they start, and send
  // "we miss you" messages once a day from 11:00 Dubai time.
  onModuleInit() {
    if (!this.push || process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => this.tick().catch(() => undefined), 10 * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (!this.push) return;
    const rules = await this.getSettings();
    const now = dubaiNow();
    const today = `${now.year}-${now.md}`;
    if (isDoubleNow(rules) && (await this.push.getSecret('double_notified')) !== today) {
      await this.push.setSecret('double_notified', today);
      await this.push.sendToAll({ title: 'Double stamps are on now', body: `Every drink earns 2 stamps until ${rules.double_to}.` });
    }
    if (now.hm >= '11:00' && (await this.push.getSecret('winback_day')) !== today) {
      await this.push.setSecret('winback_day', today);
      await this.push.winBack({ title: 'We miss you at Milestones', body: 'Your stamps are waiting. Come by for your next coffee.' });
    }
  }

  private normalizePhone(raw: unknown): string {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      throw new BadRequestException('Enter a valid phone number');
    }
    return digits;
  }

  // Staff identify a card by phone number or by the token in the card's QR code.
  private async findCard(ref: CardRef): Promise<LoyaltyCard> {
    if (typeof ref.token === 'string' && ref.token.trim()) {
      const card = await this.cards.findOne({ where: { token: ref.token.trim() } });
      if (!card) throw new NotFoundException('Card not found. Ask the customer to refresh their card.');
      return card;
    }
    const card = await this.cards.findOne({ where: { phone: this.normalizePhone(ref.phone) } });
    if (!card) throw new NotFoundException('No card for this number');
    return card;
  }

  private async newReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = randomBytes(8);
      const code = Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
      if (!(await this.cards.findOne({ where: { referral_code: code } }))) return code;
    }
    throw new Error('Could not create a referral code');
  }

  private log(card: LoyaltyCard, type: LoyaltyEventType, delta: number, staff?: StaffUser, note?: string) {
    return this.events.save(
      this.events.create({
        card_id: card.id,
        type,
        delta,
        stamps_after: card.stamps,
        branch_id: staff?.assigned_branch_id ?? null,
        staff_user_id: staff?.id ?? null,
        note: note ?? null,
      }),
    );
  }

  // Adds bonus stamps up to the target and logs what was actually added.
  private async bonus(card: LoyaltyCard, amount: number, target: number, note: string, staff?: StaffUser) {
    const before = card.stamps;
    card.stamps = Math.min(target, card.stamps + amount);
    await this.cards.save(card);
    if (card.stamps > before) await this.log(card, 'bonus', card.stamps - before, staff, note);
    return card.stamps - before;
  }

  async getSettings(): Promise<Rules> {
    const s = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (!s) return { ...DEFAULTS, double_days: [] };
    return {
      stamps_target: s.stamps_target ?? DEFAULTS.stamps_target,
      reward_name: s.reward_name ?? DEFAULTS.reward_name,
      daily_stamp_limit: s.daily_stamp_limit ?? DEFAULTS.daily_stamp_limit,
      birthday_bonus: s.birthday_bonus ?? DEFAULTS.birthday_bonus,
      referral_bonus: s.referral_bonus ?? DEFAULTS.referral_bonus,
      double_days: (s.double_days ?? '')
        .split(',')
        .filter((x) => x !== '')
        .map(Number),
      double_from: s.double_from ?? DEFAULTS.double_from,
      double_to: s.double_to ?? DEFAULTS.double_to,
      self_stamp: s.self_stamp ?? DEFAULTS.self_stamp,
      silver_visits: s.silver_visits ?? DEFAULTS.silver_visits,
      gold_visits: s.gold_visits ?? DEFAULTS.gold_visits,
      silver_perk: s.silver_perk ?? DEFAULTS.silver_perk,
      gold_perk: s.gold_perk ?? DEFAULTS.gold_perk,
      challenge_visits: s.challenge_visits ?? DEFAULTS.challenge_visits,
      challenge_bonus: s.challenge_bonus ?? DEFAULTS.challenge_bonus,
    };
  }

  // Admin: change the programme rules. Fields left out keep their current value.
  async updateSettings(body: Record<string, unknown>) {
    const cur = await this.getSettings();
    const int = (key: keyof Rules, min: number, max: number, label: string) => {
      if (body[key] === undefined) return cur[key] as number;
      const v = Number(body[key]);
      if (!Number.isInteger(v) || v < min || v > max) throw new BadRequestException(`${label} must be a whole number from ${min} to ${max}`);
      return v;
    };
    const stamps_target = int('stamps_target', 3, 30, 'Stamps needed');
    const daily_stamp_limit = int('daily_stamp_limit', 1, 10, 'Daily stamp limit');
    const birthday_bonus = int('birthday_bonus', 0, 5, 'Birthday bonus');
    const referral_bonus = int('referral_bonus', 0, 5, 'Referral bonus');

    let reward_name = cur.reward_name;
    if (body.reward_name !== undefined) {
      reward_name = typeof body.reward_name === 'string' ? body.reward_name.trim().slice(0, 80) : '';
      if (reward_name.length < 2) throw new BadRequestException('Enter a reward name');
    }

    let double_days = cur.double_days;
    if (body.double_days !== undefined) {
      if (!Array.isArray(body.double_days) || !body.double_days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
        throw new BadRequestException('Double-stamp days must be weekdays 0 to 6');
      }
      double_days = [...new Set(body.double_days as number[])].sort();
    }
    const double_from = body.double_from === undefined ? cur.double_from : String(body.double_from);
    const double_to = body.double_to === undefined ? cur.double_to : String(body.double_to);
    if (!HHMM.test(double_from) || !HHMM.test(double_to) || double_from >= double_to) {
      throw new BadRequestException('Double-stamp hours must be HH:MM, with the start before the end');
    }
    const self_stamp = typeof body.self_stamp === 'boolean' ? body.self_stamp : cur.self_stamp;
    const silver_visits = int('silver_visits', 2, 200, 'Silver tier visits');
    const gold_visits = int('gold_visits', 3, 500, 'Gold tier visits');
    if (gold_visits <= silver_visits) throw new BadRequestException('Gold tier must need more visits than Silver');
    const perk = (key: 'silver_perk' | 'gold_perk') =>
      body[key] === undefined ? cur[key] : typeof body[key] === 'string' ? (body[key] as string).trim().slice(0, 60) : '';
    const silver_perk = perk('silver_perk');
    const gold_perk = perk('gold_perk');
    const challenge_visits = int('challenge_visits', 0, 7, 'Weekly challenge visits');
    const challenge_bonus = int('challenge_bonus', 1, 5, 'Weekly challenge bonus');

    await this.settingsRepo.save({
      id: 1,
      stamps_target,
      reward_name,
      daily_stamp_limit,
      birthday_bonus,
      referral_bonus,
      double_days: double_days.join(','),
      double_from,
      double_to,
      self_stamp,
      silver_visits,
      gold_visits,
      silver_perk,
      gold_perk,
      challenge_visits,
      challenge_bonus,
    });
    return this.getSettings();
  }

  // Public settings, plus whether double stamps are on right now.
  async publicSettings() {
    const rules = await this.getSettings();
    return { ...rules, double_now: isDoubleNow(rules) };
  }

  // Public. Never reveals an existing card: if the phone is already enrolled, staff must help.
  async enroll(body: { phone?: unknown; name?: unknown; birthday?: unknown; ref?: unknown }) {
    const phone = this.normalizePhone(body.phone);
    const existing = await this.cards.findOne({ where: { phone } });
    if (existing) {
      return { ok: false, message: 'This number already has a card. Please ask our staff.' };
    }
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : null;
    const birthday = parseBirthday(body.birthday);
    let referredBy: string | null = null;
    if (typeof body.ref === 'string' && /^[A-Z0-9]{6,12}$/i.test(body.ref.trim())) {
      const referrer = await this.cards.findOne({ where: { referral_code: body.ref.trim().toUpperCase() } });
      if (referrer) referredBy = referrer.id;
    }
    const card = this.cards.create({
      phone,
      name: name || null,
      token: randomBytes(24).toString('hex'),
      stamps: 0,
      birthday,
      referral_code: await this.newReferralCode(),
      referred_by: referredBy,
      referral_rewarded: false,
    });
    await this.cards.save(card);
    await this.log(card, 'enroll', 0, undefined, referredBy ? 'Joined by referral' : undefined);
    return { ok: true, token: card.token };
  }

  // Tier from stamp visits in the last 12 months, plus this week's challenge progress.
  private async status(cardId: string, rules: Rules) {
    const yearAgo = new Date(Date.now() - 365 * 864e5);
    const week = weekStart();
    const [visits, weekVisits, challengeDone] = await Promise.all([
      this.events.count({ where: { card_id: cardId, type: 'stamp', created_at: MoreThanOrEqual(yearAgo) } }),
      rules.challenge_visits > 0
        ? this.events.count({ where: { card_id: cardId, type: 'stamp', created_at: MoreThanOrEqual(week) } })
        : Promise.resolve(0),
      rules.challenge_visits > 0
        ? this.events.count({ where: { card_id: cardId, type: 'bonus', note: CHALLENGE_NOTE, created_at: MoreThanOrEqual(week) } })
        : Promise.resolve(0),
    ]);
    const tier = tierFor(visits, rules);
    const next = tier === 'bronze' ? { tier: 'silver', at: rules.silver_visits } : tier === 'silver' ? { tier: 'gold', at: rules.gold_visits } : null;
    return {
      tier,
      tier_perk: tier === 'gold' ? rules.gold_perk : tier === 'silver' ? rules.silver_perk : '',
      visits_year: visits,
      next_tier: next?.tier ?? null,
      next_tier_at: next?.at ?? null,
      challenge:
        rules.challenge_visits > 0
          ? { target: rules.challenge_visits, bonus: rules.challenge_bonus, visits: Math.min(weekVisits, rules.challenge_visits), done: challengeDone > 0 }
          : null,
    };
  }

  // Public, by secret token only. History carries no staff notes.
  async getByToken(token: string) {
    const card = await this.cards.findOne({ where: { token } });
    if (!card) throw new NotFoundException('Card not found');
    if (!card.referral_code) {
      // Cards created before referrals existed get a code on first view.
      card.referral_code = await this.newReferralCode();
      await this.cards.save(card);
    }
    const rules = await this.getSettings();
    const history = await this.events.find({ where: { card_id: card.id }, order: { created_at: 'DESC' }, take: 10 });
    return {
      name: card.name,
      stamps: card.stamps,
      target: rules.stamps_target,
      reward_name: rules.reward_name,
      redeemed_count: card.redeemed_count,
      referral_code: card.referral_code,
      referral_bonus: rules.referral_bonus,
      has_birthday: !!card.birthday,
      double_now: isDoubleNow(rules),
      history: history.map((e) => ({ type: e.type, delta: e.delta, created_at: e.created_at })),
      ...(await this.status(card.id, rules)),
    };
  }

  // Public: a customer can add their birthday once. It cannot be changed afterwards.
  async setBirthday(token: string, body: { birthday?: unknown }) {
    const card = await this.cards.findOne({ where: { token } });
    if (!card) throw new NotFoundException('Card not found');
    if (card.birthday) return { ok: false, message: 'Birthday is already set. Ask our staff to change it.' };
    const birthday = parseBirthday(body.birthday);
    if (!birthday) throw new BadRequestException('Enter a valid birthday');
    card.birthday = birthday;
    await this.cards.save(card);
    return { ok: true };
  }

  // Staff: find customers by name or phone (max 50). Never returns the secret token.
  async search(q: unknown) {
    const term = typeof q === 'string' ? q.trim().slice(0, 100) : '';
    if (!term) return [];
    const digits = term.replace(/\D/g, '');
    const qb = this.cards.createQueryBuilder('c').where('c.name ILIKE :like', { like: `%${term}%` });
    if (digits.length >= 3) qb.orWhere('c.phone LIKE :phone', { phone: `%${digits}%` });
    const [cards, { stamps_target }] = await Promise.all([qb.orderBy('c.updated_at', 'DESC').limit(50).getMany(), this.getSettings()]);
    return cards.map((c) => ({
      phone: c.phone,
      name: c.name,
      stamps: c.stamps,
      target: stamps_target,
      redeemed_count: c.redeemed_count,
      birthday: c.birthday,
      created_at: c.created_at,
    }));
  }

  // Staff: add a stamp (two during double-stamp hours), then any birthday or referral bonus.
  // extraNote: e.g. 'Order 012' when a collected order earns the stamp.
  async addStamp(body: CardRef, staff?: StaffUser, extraNote?: string) {
    const card = await this.findCard(body);
    const rules = await this.getSettings();
    const who = { name: card.name, phone: card.phone };
    if (card.stamps >= rules.stamps_target) {
      return { ok: false, message: 'Card is full. Redeem the reward first.', stamps: card.stamps, ...who };
    }
    const last = await this.events.findOne({ where: { card_id: card.id, type: 'stamp' }, order: { created_at: 'DESC' } });
    if (last && Date.now() - new Date(last.created_at).getTime() < STAMP_COOLDOWN_MS) {
      return { ok: false, message: 'A stamp was added less than a minute ago. Wait before adding another.', stamps: card.stamps, ...who };
    }
    const now = dubaiNow();
    const today = await this.events.count({ where: { card_id: card.id, type: 'stamp', created_at: MoreThanOrEqual(now.dayStart) } });
    if (today >= rules.daily_stamp_limit) {
      return { ok: false, message: `Daily limit reached: ${rules.daily_stamp_limit} stamps a day per card.`, stamps: card.stamps, ...who };
    }

    const double = isDoubleNow(rules);
    const before = card.stamps;
    card.stamps = Math.min(rules.stamps_target, card.stamps + (double ? 2 : 1));
    await this.cards.save(card);
    const note = [staff?.role === 'self' ? 'Self-stamp at counter' : '', extraNote ?? '', double ? 'Double stamps' : ''].filter(Boolean).join(' · ');
    await this.log(card, 'stamp', card.stamps - before, staff, note || undefined);

    const bonuses: string[] = [];
    if (card.birthday && rules.birthday_bonus > 0 && card.birthday_rewarded_year !== now.year && nearBirthday(card.birthday, now.md)) {
      card.birthday_rewarded_year = now.year;
      if ((await this.bonus(card, rules.birthday_bonus, rules.stamps_target, 'Birthday', staff)) > 0) bonuses.push('birthday');
      else await this.cards.save(card);
    }
    if (card.referred_by && !card.referral_rewarded) {
      card.referral_rewarded = true;
      await this.cards.save(card);
      if (rules.referral_bonus > 0) {
        await this.bonus(card, rules.referral_bonus, rules.stamps_target, 'Referral: welcome bonus', staff);
        const referrer = await this.cards.findOne({ where: { id: card.referred_by } });
        if (referrer) await this.bonus(referrer, rules.referral_bonus, rules.stamps_target, 'Referral: friend joined', staff);
        bonuses.push('referral');
      }
    }
    if (rules.challenge_visits > 0) {
      const week = weekStart();
      const [weekVisits, already] = await Promise.all([
        this.events.count({ where: { card_id: card.id, type: 'stamp', created_at: MoreThanOrEqual(week) } }),
        this.events.count({ where: { card_id: card.id, type: 'bonus', note: CHALLENGE_NOTE, created_at: MoreThanOrEqual(week) } }),
      ]);
      if (weekVisits >= rules.challenge_visits && already === 0) {
        if ((await this.bonus(card, rules.challenge_bonus, rules.stamps_target, CHALLENGE_NOTE, staff)) > 0) bonuses.push('challenge');
      }
    }
    if (this.push) {
      const left = rules.stamps_target - card.stamps;
      const msg =
        left <= 0
          ? { title: `Your ${rules.reward_name.toLowerCase()} is ready`, body: 'Show your card at the counter to claim it.' }
          : left === 1
            ? { title: '1 stamp to go', body: `One more visit for your ${rules.reward_name.toLowerCase()}.` }
            : null;
      if (msg) this.push.sendToCard(card.id, msg).catch(() => undefined);
    }
    const visits = await this.events.count({ where: { card_id: card.id, type: 'stamp', created_at: MoreThanOrEqual(new Date(Date.now() - 365 * 864e5)) } });
    const tier = tierFor(visits, rules);
    const tier_perk = tier === 'gold' ? rules.gold_perk : tier === 'silver' ? rules.silver_perk : '';
    return { ok: true, stamps: card.stamps, earned: card.stamps - before, double, bonuses, tier, tier_perk, ...who };
  }

  // Staff: the code currently shown on a branch's counter screen.
  async counter(branchId: unknown, staff: StaffUser) {
    const { self_stamp } = await this.getSettings();
    if (!self_stamp) throw new BadRequestException('Turn on counter self-stamp in the programme rules first');
    if (typeof branchId !== 'string' || !BRANCH_ID.test(branchId)) throw new BadRequestException('Choose a branch');
    if (staff.role !== 'admin' && staff.assigned_branch_id && staff.assigned_branch_id !== branchId) {
      throw new ForbiddenException('You can only show the code for your own branch');
    }
    const branch = await this.branches.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    const now = Date.now();
    const window = Math.floor(now / COUNTER_WINDOW_MS);
    return {
      branch_id: branch.id,
      branch_name: branch.name,
      code: `${branch.id}.${counterCode(counterSecret(), branch.id, window)}`,
      expires_in_ms: COUNTER_WINDOW_MS - (now % COUNTER_WINDOW_MS),
    };
  }

  // Public: the customer scanned the counter code with their card open. Same rules as a staff stamp.
  async selfStamp(body: { token?: unknown; code?: unknown }) {
    const { self_stamp } = await this.getSettings();
    if (!self_stamp) return { ok: false, message: 'Counter stamps are off right now. Please ask our staff.' };
    if (typeof body.token !== 'string' || !body.token.trim()) throw new BadRequestException('Open your rewards card first');
    const m = typeof body.code === 'string' ? body.code.trim().match(/^([a-f0-9-]{8,64})\.([A-Z2-9]{8})$/i) : null;
    if (!m) return { ok: false, message: 'That is not a Milestones counter code.' };
    const branch = await this.branches.findOne({ where: { id: m[1] } });
    if (!branch || branch.status !== 'active') return { ok: false, message: 'That is not a Milestones counter code.' };
    const given = Buffer.from(m[2].toUpperCase());
    const window = Math.floor(Date.now() / COUNTER_WINDOW_MS);
    const valid = [window, window - 1].some((w) => timingSafeEqual(given, Buffer.from(counterCode(counterSecret(), branch.id, w))));
    if (!valid) return { ok: false, message: 'This code has expired. Scan the code on the counter screen again.' };
    const res = await this.addStamp({ token: body.token }, { id: null, role: 'self', assigned_branch_id: branch.id });
    const out: Record<string, unknown> = { ...res, branch_name: branch.name };
    delete out.phone; // the customer already knows it; keep it out of public responses
    return out;
  }

  // Staff: redeem a full card and reset it.
  async redeem(body: CardRef, staff?: StaffUser) {
    const card = await this.findCard(body);
    const { stamps_target } = await this.getSettings();
    if (card.stamps < stamps_target) {
      return { ok: false, message: `Card needs ${stamps_target} stamps to redeem`, stamps: card.stamps };
    }
    const used = card.stamps;
    card.stamps = 0;
    card.redeemed_count += 1;
    await this.cards.save(card);
    await this.log(card, 'redeem', -used, staff);
    return { ok: true, stamps: 0, redeemed_count: card.redeemed_count };
  }

  // Admin: add or remove stamps by hand, with a required reason. Clamped to 0..target.
  async adjust(body: { phone?: unknown; delta?: unknown; note?: unknown }, staff?: StaffUser) {
    const delta = Number(body.delta);
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 30) {
      throw new BadRequestException('Change must be a whole number from -30 to 30, not 0');
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '';
    if (note.length < 3) throw new BadRequestException('Enter a reason for the change');
    const card = await this.findCard({ phone: body.phone });
    const { stamps_target } = await this.getSettings();
    const next = Math.min(stamps_target, Math.max(0, card.stamps + delta));
    const applied = next - card.stamps;
    if (applied === 0) {
      return { ok: false, message: 'No change: the card is already at that limit.', stamps: card.stamps };
    }
    card.stamps = next;
    await this.cards.save(card);
    await this.log(card, 'adjust', applied, staff, note);
    return { ok: true, stamps: card.stamps };
  }

  // Staff: last 50 events for one card, with staff email and branch name.
  async historyByPhone(raw: unknown) {
    const card = await this.findCard({ phone: raw });
    const list = await this.events.find({ where: { card_id: card.id }, order: { created_at: 'DESC' }, take: 50 });
    const userIds = [...new Set(list.map((e) => e.staff_user_id).filter((x): x is string => !!x))];
    const branchIds = [...new Set(list.map((e) => e.branch_id).filter((x): x is string => !!x))];
    const [users, branches] = await Promise.all([
      userIds.length ? this.users.find({ where: { id: In(userIds) } }) : Promise.resolve([] as User[]),
      branchIds.length ? this.branches.find({ where: { id: In(branchIds) } }) : Promise.resolve([] as Branch[]),
    ]);
    const email = new Map(users.map((u) => [u.id, u.email]));
    const branchName = new Map(branches.map((b) => [b.id, b.name]));
    return list.map((e) => ({
      type: e.type,
      delta: e.delta,
      stamps_after: e.stamps_after,
      note: e.note,
      staff: e.staff_user_id ? (email.get(e.staff_user_id) ?? null) : null,
      branch: e.branch_id ? (branchName.get(e.branch_id) ?? null) : null,
      created_at: e.created_at,
    }));
  }

  // Staff: programme numbers. Event counts cover the time since history started.
  async stats() {
    const now = Date.now();
    const week = new Date(now - 7 * 864e5);
    const month = new Date(now - 30 * 864e5);
    const { stamps_target } = await this.getSettings();
    const [members, newThisWeek, stampsThisWeek, redemptionsThisMonth, readyToRedeem, referralsThisMonth] = await Promise.all([
      this.cards.count(),
      this.cards.count({ where: { created_at: MoreThanOrEqual(week) } }),
      this.events.count({ where: { type: 'stamp', created_at: MoreThanOrEqual(week) } }),
      this.events.count({ where: { type: 'redeem', created_at: MoreThanOrEqual(month) } }),
      this.cards.count({ where: { stamps: MoreThanOrEqual(stamps_target) } }),
      this.events.count({ where: { type: 'bonus', note: 'Referral: welcome bonus', created_at: MoreThanOrEqual(month) } }),
    ]);
    return {
      members,
      new_this_week: newThisWeek,
      stamps_this_week: stampsThisWeek,
      redemptions_this_month: redemptionsThisMonth,
      ready_to_redeem: readyToRedeem,
      referrals_this_month: referralsThisMonth,
      stamps_target,
    };
  }
}
