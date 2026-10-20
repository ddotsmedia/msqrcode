import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import { QrCode } from '../entities/qr-code.entity';

type Dict = Record<string, unknown>;
const HEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_CAPTION = 'Scan to view the menu';

// Posters and phone cameras need a web link: opening it lands on the branch menu.
const MENU_URL = (process.env.MENU_PUBLIC_URL || 'https://coffeesales.ae').replace(/\/$/, '');

export function qrPayload(branchId: string, kind: string, tableNumber: string | null, promotionId?: string | null): string {
  if (kind === 'promo' && promotionId) return `${MENU_URL}/offers?promo=${promotionId}`;
  const base = `${MENU_URL}/?branch=${branchId}`;
  if (kind === 'feedback') return `${base}&feedback=1`;
  return kind === 'table' && tableNumber ? `${base}&table=${encodeURIComponent(tableNumber)}` : base;
}

function text(v: unknown, field: string, max: number, required = false): string | null {
  const s = v === undefined || v === null ? '' : String(v).trim();
  if (!s) {
    if (required) throw new BadRequestException(`${field} is required`);
    return null;
  }
  if (s.length > max) throw new BadRequestException(`${field} must be at most ${max} characters`);
  return s;
}

function color(v: unknown, field: string): string | undefined {
  if (v === undefined) return undefined;
  const s = String(v);
  if (!HEX.test(s)) throw new BadRequestException(`${field} must be a hex color like #112233`);
  return s;
}

@Injectable()
export class QrCodesService {
  constructor(
    @InjectRepository(QrCode) private qr: Repository<QrCode>,
    @InjectRepository(Branch) private branches: Repository<Branch>,
  ) {}

  async list(branchId?: string) {
    const rows = await this.qr.find({
      where: branchId ? { branch_id: branchId } : {},
      relations: ['branch'],
      order: { created_at: 'ASC' },
    });
    return rows.map((r) => ({
      ...r,
      payload: qrPayload(r.branch_id, r.kind, r.table_number, r.promotion_id),
      has_artwork: !!r.artwork_name,
    }));
  }

  async getArtwork(id: string) {
    const row = await this.qr
      .createQueryBuilder('q')
      .addSelect('q.artwork_data')
      .where('q.id = :id', { id })
      .getOne();
    if (!row) throw new NotFoundException('QR code not found');
    return {
      name: row.artwork_name,
      data_url: row.artwork_data,
      x: row.artwork_x,
      y: row.artwork_y,
      size: row.artwork_size,
    };
  }

  async saveArtwork(id: string, body: Dict) {
    const row = await this.qr.findOne({ where: { id } });
    if (!row) throw new NotFoundException('QR code not found');
    const dataUrl = typeof body.data_url === 'string' ? body.data_url : '';
    if (!/^data:image\/(jpeg|png);base64,/.test(dataUrl)) {
      throw new BadRequestException('Menu image must be a PNG or JPG file');
    }
    if (dataUrl.length > 9_000_000) {
      throw new BadRequestException('Menu image is too large (max about 6 MB). Use a smaller image or choose Screen size.');
    }
    const num = (v: unknown, min: number, max: number): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
    };
    await this.qr.update(id, {
      artwork_data: dataUrl,
      artwork_name: text(body.name, 'name', 255) ?? 'menu-image',
      artwork_x: num(body.x, 0, 100),
      artwork_y: num(body.y, 0, 100),
      artwork_size: num(body.size, 1, 100),
    });
    return { ok: true };
  }

  async removeArtwork(id: string) {
    await this.qr.update(id, {
      artwork_data: null,
      artwork_name: null,
      artwork_x: null,
      artwork_y: null,
      artwork_size: null,
    });
    return { ok: true };
  }

  async create(body: Dict) {
    const branchId = text(body.branch_id, 'branch_id', 36, true)!;
    const branch = await this.branches.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    const kind = body.kind === 'table' || body.kind === 'feedback' || body.kind === 'promo' ? body.kind : 'branch';
    const tableNumber = kind === 'table' ? text(body.table_number, 'table_number', 20, true) : null;
    const promotionId = kind === 'promo' ? text(body.promotion_id, 'promotion_id', 36, true) : null;
    if (promotionId && !/^[a-f0-9-]{36}$/i.test(promotionId)) throw new BadRequestException('promotion_id is not valid');

    const existing = await this.qr.findOne({
      where: { branch_id: branchId, kind, table_number: tableNumber ?? IsNull(), promotion_id: promotionId ?? IsNull() },
    });
    if (existing) {
      throw new BadRequestException(
        kind === 'table'
          ? `Table ${tableNumber} already has a QR code`
          : kind === 'promo'
            ? 'This offer already has a QR code'
            : kind === 'feedback'
              ? 'This branch already has a feedback QR code'
              : 'This branch already has a branch QR code',
      );
    }

    const defaultLabel =
      kind === 'table' ? `${branch.name} · Table ${tableNumber}` : kind === 'feedback' ? `${branch.name} · Feedback` : kind === 'promo' ? `${branch.name} · Offer` : branch.name;
    const row = this.qr.create({
      branch_id: branchId,
      kind,
      table_number: tableNumber,
      promotion_id: promotionId,
      label: text(body.label, 'label', 120) ?? defaultLabel,
      caption: text(body.caption, 'caption', 120) ?? DEFAULT_CAPTION,
      foreground: color(body.foreground, 'foreground') ?? '#111111',
      background: color(body.background, 'background') ?? '#ffffff',
      is_active: true,
    });
    return this.qr.save(row);
  }

  // Creates table codes for a numbered range, skipping tables that already have one.
  async createTables(body: Dict) {
    const branchId = text(body.branch_id, 'branch_id', 36, true)!;
    const from = Number(body.from);
    const to = Number(body.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to - from > 99) {
      throw new BadRequestException('Enter a table range starting at 1, with at most 100 tables per run');
    }
    const branch = await this.branches.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    const existing = await this.qr.find({ where: { branch_id: branchId, kind: 'table' } });
    const taken = new Set(existing.map((e) => e.table_number));
    const rows: QrCode[] = [];
    for (let n = from; n <= to; n++) {
      const t = String(n);
      if (taken.has(t)) continue;
      rows.push(
        this.qr.create({
          branch_id: branchId,
          kind: 'table',
          table_number: t,
          label: `${branch.name} · Table ${t}`,
          caption: DEFAULT_CAPTION,
          foreground: '#111111',
          background: '#ffffff',
          is_active: true,
        }),
      );
    }
    const saved = await this.qr.save(rows);
    return { created: saved.length, skipped: to - from + 1 - saved.length };
  }

  async update(id: string, body: Dict) {
    const row = await this.qr.findOne({ where: { id } });
    if (!row) throw new NotFoundException('QR code not found');
    if (body.label !== undefined) row.label = text(body.label, 'label', 120, true)!;
    if (body.caption !== undefined) row.caption = text(body.caption, 'caption', 120) ?? DEFAULT_CAPTION;
    const fg = color(body.foreground, 'foreground');
    if (fg) row.foreground = fg;
    const bg = color(body.background, 'background');
    if (bg) row.background = bg;
    if (typeof body.is_active === 'boolean') row.is_active = body.is_active;
    return this.qr.save(row);
  }

  // Pauses a code instead of deleting it, so printed copies stay traceable.
  async deactivate(id: string) {
    const row = await this.qr.findOne({ where: { id } });
    if (!row) throw new NotFoundException('QR code not found');
    row.is_active = false;
    return this.qr.save(row);
  }
}
