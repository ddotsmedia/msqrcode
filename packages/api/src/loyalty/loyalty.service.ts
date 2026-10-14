import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { LoyaltyCard } from '../entities/loyalty-card.entity';

export const STAMPS_TARGET = 10;

@Injectable()
export class LoyaltyService {
  constructor(@InjectRepository(LoyaltyCard) private cards: Repository<LoyaltyCard>) {}

  private normalizePhone(raw: unknown): string {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      throw new BadRequestException('Enter a valid phone number');
    }
    return digits;
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
    return { ok: true, token: card.token };
  }

  // Public, by secret token only.
  async getByToken(token: string) {
    const card = await this.cards.findOne({ where: { token } });
    if (!card) throw new NotFoundException('Card not found');
    return {
      name: card.name,
      stamps: card.stamps,
      target: STAMPS_TARGET,
      redeemed_count: card.redeemed_count,
    };
  }

  // Staff: find customers by name or phone (max 50). Never returns the secret token.
  async search(q: unknown) {
    const term = typeof q === 'string' ? q.trim().slice(0, 100) : '';
    if (!term) return [];
    const digits = term.replace(/\D/g, '');
    const qb = this.cards.createQueryBuilder('c').where('c.name ILIKE :like', { like: `%${term}%` });
    if (digits.length >= 3) qb.orWhere('c.phone LIKE :phone', { phone: `%${digits}%` });
    const cards = await qb.orderBy('c.updated_at', 'DESC').limit(50).getMany();
    return cards.map((c) => ({
      phone: c.phone,
      name: c.name,
      stamps: c.stamps,
      target: STAMPS_TARGET,
      redeemed_count: c.redeemed_count,
      created_at: c.created_at,
    }));
  }

  // Staff: add one stamp. Card stays at the target until redeemed.
  async addStamp(body: { phone?: unknown }) {
    const phone = this.normalizePhone(body.phone);
    const card = await this.cards.findOne({ where: { phone } });
    if (!card) throw new NotFoundException('No card for this number');
    if (card.stamps >= STAMPS_TARGET) {
      return { ok: false, message: 'Card is full. Redeem the reward first.', stamps: card.stamps };
    }
    card.stamps += 1;
    await this.cards.save(card);
    return { ok: true, stamps: card.stamps };
  }

  // Staff: redeem a full card and reset it.
  async redeem(body: { phone?: unknown }) {
    const phone = this.normalizePhone(body.phone);
    const card = await this.cards.findOne({ where: { phone } });
    if (!card) throw new NotFoundException('No card for this number');
    if (card.stamps < STAMPS_TARGET) {
      return { ok: false, message: `Card needs ${STAMPS_TARGET} stamps to redeem`, stamps: card.stamps };
    }
    card.stamps = 0;
    card.redeemed_count += 1;
    await this.cards.save(card);
    return { ok: true, stamps: 0, redeemed_count: card.redeemed_count };
  }
}
