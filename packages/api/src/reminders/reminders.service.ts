import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OfferReminder } from '../entities/offer-reminder.entity';
import { Promotion } from '../entities/promotion.entity';
import { LoyaltyCard } from '../entities/loyalty-card.entity';
import { PushService } from '../push/push.service';
import { nextStart } from './starts-soon';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LEAD_MIN = 15; // minutes before the start
const MAX_PER_CARD = 10;

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger(RemindersService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(OfferReminder) private reminders: Repository<OfferReminder>,
    @InjectRepository(Promotion) private promos: Repository<Promotion>,
    @InjectRepository(LoyaltyCard) private cards: Repository<LoyaltyCard>,
    @Optional() private push?: PushService,
  ) {}

  onModuleInit() {
    if (!this.push || process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => this.tick().catch((e) => this.log.warn(`reminders: ${(e as Error).message}`)), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async card(token: unknown) {
    const t = typeof token === 'string' ? token.trim().slice(0, 128) : '';
    const card = t ? await this.cards.findOne({ where: { token: t } }) : null;
    if (!card) throw new NotFoundException('Join our free rewards to get reminders');
    return card;
  }

  // Customer: the offers this card asked to be reminded about.
  async list(token: unknown) {
    const card = await this.card(token).catch(() => null);
    if (!card) return [];
    return (await this.reminders.find({ where: { card_id: card.id } })).map((r) => r.promotion_id);
  }

  // Customer: turn the reminder for one happy hour on or off.
  async set(body: { token?: unknown; promotion_id?: unknown; on?: unknown }) {
    const card = await this.card(body?.token);
    const id = typeof body?.promotion_id === 'string' && UUID.test(body.promotion_id) ? body.promotion_id : '';
    const p = id ? await this.promos.findOne({ where: { id } }) : null;
    if (!p || !p.is_active || !p.discount_percent || !p.start_time) throw new BadRequestException('Reminders are only for timed happy hours');
    const existing = await this.reminders.findOne({ where: { promotion_id: p.id, card_id: card.id } });
    if (body?.on === false) {
      if (existing) await this.reminders.delete({ id: existing.id });
      return { on: false };
    }
    if (!existing) {
      if ((await this.reminders.count({ where: { card_id: card.id } })) >= MAX_PER_CARD) throw new BadRequestException('You can have up to 10 reminders');
      await this.reminders.save(this.reminders.create({ promotion_id: p.id, card_id: card.id }));
    }
    return { on: true };
  }

  // Every minute: happy hours starting in about 15 minutes notify the cards that asked (once per start).
  async tick(now = new Date()) {
    if (!this.push) return 0;
    const promos = (await this.promos.find({ where: { is_active: true } })).filter((p) => {
      const at = nextStart(p, now);
      const mins = at ? (at.getTime() - now.getTime()) / 60_000 : Infinity;
      return mins > LEAD_MIN - 2 && mins <= LEAD_MIN; // a two-minute window so a late tick still catches it
    });
    if (!promos.length) return 0;
    const due = await this.reminders.find({ where: { promotion_id: In(promos.map((p) => p.id)) } });
    let sent = 0;
    for (const r of due) {
      if (r.last_sent_at && now.getTime() - r.last_sent_at.getTime() < 2 * 3600_000) continue;
      const p = promos.find((x) => x.id === r.promotion_id)!;
      r.last_sent_at = now;
      await this.reminders.save(r);
      await this.push.sendToCard(r.card_id, { title: `${p.title} starts in ${LEAD_MIN} minutes`, body: `${p.discount_percent}% off from ${p.start_time}. See you soon!`, url: '/offers' });
      sent++;
    }
    return sent;
  }
}
