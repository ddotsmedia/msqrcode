import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { LoyaltyCard } from '../entities/loyalty-card.entity';
import { LoyaltyEvent, LoyaltyEventType } from '../entities/loyalty-event.entity';
import { LoyaltySettings } from '../entities/loyalty-settings.entity';
import { User } from '../entities/user.entity';
import { Branch } from '../entities/branch.entity';

// Defaults used until an admin saves the settings.
export const STAMPS_TARGET = 10;
const DEFAULT_REWARD = 'Free drink';
// Blocks an accidental second stamp from a double tap or two staff members at once.
const STAMP_COOLDOWN_MS = 60_000;

export interface StaffUser {
  id: string;
  role: string;
  assigned_branch_id?: string | null;
}

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyCard) private cards: Repository<LoyaltyCard>,
    @InjectRepository(LoyaltyEvent) private events: Repository<LoyaltyEvent>,
    @InjectRepository(LoyaltySettings) private settingsRepo: Repository<LoyaltySettings>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Branch) private branches: Repository<Branch>,
  ) {}

  private normalizePhone(raw: unknown): string {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      throw new BadRequestException('Enter a valid phone number');
    }
    return digits;
  }

  private async cardByPhone(raw: unknown): Promise<LoyaltyCard> {
    const phone = this.normalizePhone(raw);
    const card = await this.cards.findOne({ where: { phone } });
    if (!card) throw new NotFoundException('No card for this number');
    return card;
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

  async getSettings() {
    const s = await this.settingsRepo.findOne({ where: { id: 1 } });
    return {
      stamps_target: s?.stamps_target ?? STAMPS_TARGET,
      reward_name: s?.reward_name ?? DEFAULT_REWARD,
    };
  }

  // Admin: change the programme rules.
  async updateSettings(body: { stamps_target?: unknown; reward_name?: unknown }) {
    const target = Number(body.stamps_target);
    if (!Number.isInteger(target) || target < 3 || target > 30) {
      throw new BadRequestException('Stamps needed must be a whole number from 3 to 30');
    }
    const reward = typeof body.reward_name === 'string' ? body.reward_name.trim().slice(0, 80) : '';
    if (reward.length < 2) throw new BadRequestException('Enter a reward name');
    await this.settingsRepo.save({ id: 1, stamps_target: target, reward_name: reward });
    return this.getSettings();
  }

  // Public. Never reveals an existing card: if the phone is already enrolled, staff must help.
  async enroll(body: { phone?: unknown; name?: unknown }) {
    const phone = this.normalizePhone(body.phone);
    const existing = await this.cards.findOne({ where: { phone } });
    if (existing) {
      return { ok: false, message: 'This number already has a card. Please ask our staff.' };
    }
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : null;
    const card = this.cards.create({
      phone,
      name: name || null,
      token: randomBytes(24).toString('hex'),
      stamps: 0,
    });
    await this.cards.save(card);
    await this.log(card, 'enroll', 0);
    return { ok: true, token: card.token };
  }

  // Public, by secret token only. History carries no staff notes.
  async getByToken(token: string) {
    const card = await this.cards.findOne({ where: { token } });
    if (!card) throw new NotFoundException('Card not found');
    const { stamps_target, reward_name } = await this.getSettings();
    const history = await this.events.find({ where: { card_id: card.id }, order: { created_at: 'DESC' }, take: 10 });
    return {
      name: card.name,
      stamps: card.stamps,
      target: stamps_target,
      reward_name,
      redeemed_count: card.redeemed_count,
      history: history.map((e) => ({ type: e.type, delta: e.delta, created_at: e.created_at })),
    };
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
      created_at: c.created_at,
    }));
  }

  // Staff: add one stamp. Card stays at the target until redeemed.
  async addStamp(body: { phone?: unknown }, staff?: StaffUser) {
    const card = await this.cardByPhone(body.phone);
    const { stamps_target } = await this.getSettings();
    if (card.stamps >= stamps_target) {
      return { ok: false, message: 'Card is full. Redeem the reward first.', stamps: card.stamps };
    }
    const last = await this.events.findOne({ where: { card_id: card.id, type: 'stamp' }, order: { created_at: 'DESC' } });
    if (last && Date.now() - new Date(last.created_at).getTime() < STAMP_COOLDOWN_MS) {
      return { ok: false, message: 'A stamp was added less than a minute ago. Wait before adding another.', stamps: card.stamps };
    }
    card.stamps += 1;
    await this.cards.save(card);
    await this.log(card, 'stamp', 1, staff);
    return { ok: true, stamps: card.stamps };
  }

  // Staff: redeem a full card and reset it.
  async redeem(body: { phone?: unknown }, staff?: StaffUser) {
    const card = await this.cardByPhone(body.phone);
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
    const card = await this.cardByPhone(body.phone);
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
    const card = await this.cardByPhone(raw);
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
    const [members, newThisWeek, stampsThisWeek, redemptionsThisMonth, readyToRedeem] = await Promise.all([
      this.cards.count(),
      this.cards.count({ where: { created_at: MoreThanOrEqual(week) } }),
      this.events.count({ where: { type: 'stamp', created_at: MoreThanOrEqual(week) } }),
      this.events.count({ where: { type: 'redeem', created_at: MoreThanOrEqual(month) } }),
      this.cards.count({ where: { stamps: MoreThanOrEqual(stamps_target) } }),
    ]);
    return {
      members,
      new_this_week: newThisWeek,
      stamps_this_week: stampsThisWeek,
      redemptions_this_month: redemptionsThisMonth,
      ready_to_redeem: readyToRedeem,
      stamps_target,
    };
  }
}
