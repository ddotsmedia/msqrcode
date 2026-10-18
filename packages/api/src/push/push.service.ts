import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushSubscription } from '../entities/push-subscription.entity';
import { AppSecret } from '../entities/app-secret.entity';
import { LoyaltyCard } from '../entities/loyalty-card.entity';

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
}

const BROADCAST_GAP_MS = 60 * 60_000; // admins can send to everyone at most once an hour

@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);
  private keys: { publicKey: string; privateKey: string } | null = null;

  constructor(
    @InjectRepository(PushSubscription) private subs: Repository<PushSubscription>,
    @InjectRepository(AppSecret) private secrets: Repository<AppSecret>,
    @InjectRepository(LoyaltyCard) private cards: Repository<LoyaltyCard>,
  ) {}

  async getSecret(key: string) {
    return (await this.secrets.findOne({ where: { key } }))?.value ?? null;
  }

  async setSecret(key: string, value: string) {
    await this.secrets.save({ key, value });
  }

  // Signing keys are created on first use and kept in the database, so no extra server settings are needed.
  private async vapid() {
    if (this.keys) return this.keys;
    const saved = await this.getSecret('vapid');
    let keys = saved ? (JSON.parse(saved) as { publicKey: string; privateKey: string }) : null;
    if (!keys) {
      keys = webpush.generateVAPIDKeys();
      await this.setSecret('vapid', JSON.stringify(keys));
    }
    this.keys = keys;
    return keys;
  }

  async publicKey() {
    return { key: (await this.vapid()).publicKey };
  }

  async subscribe(body: { token?: unknown; subscription?: unknown }) {
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const s = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
    const endpoint = typeof s?.endpoint === 'string' ? s.endpoint : '';
    const p256dh = typeof s?.keys?.p256dh === 'string' ? s.keys.p256dh : '';
    const auth = typeof s?.keys?.auth === 'string' ? s.keys.auth : '';
    if (!token || !/^https:\/\/[^\s]{10,590}$/.test(endpoint) || !p256dh || p256dh.length > 200 || !auth || auth.length > 100) {
      throw new BadRequestException('Could not turn on notifications');
    }
    const card = await this.cards.findOne({ where: { token } });
    if (!card) throw new NotFoundException('Card not found');
    const existing = await this.subs.findOne({ where: { endpoint } });
    await this.subs.save({ ...(existing ?? {}), endpoint, p256dh, auth, card_id: card.id });
    return { ok: true };
  }

  async unsubscribe(body: { endpoint?: unknown }) {
    if (typeof body.endpoint === 'string') await this.subs.delete({ endpoint: body.endpoint });
    return { ok: true };
  }

  // Sends to one subscription; drops it when the browser says it no longer exists.
  private async send(sub: PushSubscription, msg: PushMessage) {
    const { publicKey, privateKey } = await this.vapid();
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: msg.title, body: msg.body, url: msg.url ?? '/loyalty' }),
        { vapidDetails: { subject: process.env.PUSH_CONTACT || 'mailto:hello@coffeesales.ae', publicKey, privateKey }, TTL: 6 * 3600 },
      );
      return true;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await this.subs.delete({ id: sub.id });
      else this.log.warn(`push failed (${code ?? 'no status'})`);
      return false;
    }
  }

  async sendToCard(cardId: string, msg: PushMessage) {
    const list = await this.subs.find({ where: { card_id: cardId } });
    await Promise.all(list.map((s) => this.send(s, msg)));
  }

  // Everyone with notifications on, 20 at a time.
  async sendToAll(msg: PushMessage) {
    const list = await this.subs.find({ take: 10_000 });
    let sent = 0;
    for (let i = 0; i < list.length; i += 20) {
      const results = await Promise.all(list.slice(i, i + 20).map((s) => this.send(s, msg)));
      sent += results.filter(Boolean).length;
    }
    return sent;
  }

  async broadcast(body: { title?: unknown; body?: unknown }) {
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 60) : '';
    const text = typeof body.body === 'string' ? body.body.trim().slice(0, 160) : '';
    if (title.length < 2 || text.length < 2) throw new BadRequestException('Enter a title and a message');
    const last = Number((await this.getSecret('last_broadcast')) ?? 0);
    const wait = last + BROADCAST_GAP_MS - Date.now();
    if (wait > 0) return { ok: false, message: `You can send the next message in ${Math.ceil(wait / 60000)} minutes.` };
    await this.setSecret('last_broadcast', String(Date.now()));
    return { ok: true, sent: await this.sendToAll({ title, body: text }) };
  }

  async stats() {
    return { subscribers: await this.subs.count() };
  }

  // "We miss you": subscribers with no stamp for 30 days, at most once every 60 days.
  async winBack(msg: PushMessage) {
    const due: PushSubscription[] = await this.subs
      .createQueryBuilder('s')
      .innerJoin(LoyaltyCard, 'c', 'c.id = s.card_id')
      .where("(s.winback_sent_at IS NULL OR s.winback_sent_at < now() - interval '60 days')")
      .andWhere(
        "COALESCE((SELECT max(e.created_at) FROM loyalty_events e WHERE e.card_id = c.id AND e.type = 'stamp'), c.created_at) < now() - interval '30 days'",
      )
      .limit(500)
      .getMany();
    for (const s of due) {
      if (await this.send(s, msg)) await this.subs.update({ id: s.id }, { winback_sent_at: new Date() });
    }
    return due.length;
  }
}
