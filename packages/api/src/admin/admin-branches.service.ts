import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import { QrCode } from '../entities/qr-code.entity';
import { amenities } from '../branches/amenities';

type Dict = Record<string, unknown>;

const DEFAULT_TIMEZONE = 'Asia/Dubai';
const DEFAULT_HOURS = { open: '08:00', close: '22:00' };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function text(v: unknown, field: string, max: number, required = false): string | null {
  const s = v === undefined || v === null ? '' : String(v).trim();
  if (!s) {
    if (required) throw new BadRequestException(`${field} is required`);
    return null;
  }
  if (s.length > max) throw new BadRequestException(`${field} must be at most ${max} characters`);
  return s;
}

function validateUrl(v: unknown, field: string): string | null {
  const s = text(v, field, 500);
  if (!s) return null;
  if (!s.startsWith('https://')) throw new BadRequestException(`${field} must start with https://`);
  return s;
}

// Delivery app links: up to 10 named https links.
function validateLinks(v: unknown): Record<string, string> | null {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, url] of Object.entries(v as Record<string, unknown>).slice(0, 10)) {
    const s = validateUrl(url, `delivery_links.${k.slice(0, 30)}`);
    if (s) out[k.slice(0, 30)] = s;
  }
  return Object.keys(out).length ? out : null;
}

function validateWhatsApp(v: unknown): string | null {
  const s = text(v, 'whatsapp_number', 20);
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) throw new BadRequestException('WhatsApp number must be 7-15 digits');
  return digits;
}

// "Milestones Marina Walk" -> "MILESTONES-MARINA-WALK"
function baseCode(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'BRANCH';
}

@Injectable()
export class AdminBranchesService {
  constructor(
    @InjectRepository(Branch) private branches: Repository<Branch>,
    @InjectRepository(QrCode) private qr: Repository<QrCode>,
  ) {}

  list() {
    return this.branches.find({ order: { name: 'ASC' } });
  }

  private async uniqueCode(name: string): Promise<string> {
    const base = baseCode(name);
    let code = base;
    let n = 2;
    while (await this.branches.findOne({ where: { code } })) {
      code = `${base}-${n++}`;
    }
    return code;
  }

  // Creates the branch and its branch QR code, so it can be printed straight away.
  async create(body: Dict) {
    const name = text(body.name, 'name', 120, true)!;
    const defaultHours = Object.fromEntries(DAYS.map((d) => [d, { ...DEFAULT_HOURS }]));
    const branch = await this.branches.save(
      this.branches.create({
        code: await this.uniqueCode(name),
        name,
        description: text(body.description, 'description', 1000) ?? '',
        address: text(body.address, 'address', 255) ?? '',
        phone: text(body.phone, 'phone', 20) ?? '',
        timezone: text(body.timezone, 'timezone', 50) ?? DEFAULT_TIMEZONE,
        operating_hours: defaultHours,
        status: body.status === 'inactive' ? 'inactive' : 'active',
      }),
    );
    await this.qr.save(
      this.qr.create({
        branch_id: branch.id,
        kind: 'branch',
        table_number: null,
        label: branch.name,
        caption: 'Scan to view the menu',
        foreground: '#111111',
        background: '#ffffff',
        is_active: true,
      }),
    );
    return branch;
  }

  // Opening hours: { Monday: { open: 'HH:MM', close: 'HH:MM' }, ... }; a day left out is closed.
  private hours(v: unknown, field: string, allowNull: boolean): Record<string, { open: string; close: string }> | null {
    if (v === null && allowNull) return null;
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new BadRequestException(`${field} must be a list of days`);
    const out: Record<string, { open: string; close: string }> = {};
    for (const d of DAYS) {
      const day = (v as Record<string, any>)[d];
      if (!day) continue;
      if (!HHMM.test(String(day.open)) || !HHMM.test(String(day.close))) throw new BadRequestException(`${field}: ${d} times must be HH:MM`);
      if (day.open === day.close) throw new BadRequestException(`${field}: ${d} opens and closes at the same time`);
      out[d] = { open: day.open, close: day.close };
    }
    return out;
  }

  // The code is fixed once created, since QR codes and links depend on the branch id, not the code.
  async update(id: string, body: Dict) {
    const branch = await this.branches.findOne({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');
    if (body.name !== undefined) branch.name = text(body.name, 'name', 120, true)!;
    if (body.address !== undefined) branch.address = text(body.address, 'address', 255) ?? '';
    if (body.phone !== undefined) branch.phone = text(body.phone, 'phone', 20) ?? '';
    if (body.timezone !== undefined) branch.timezone = text(body.timezone, 'timezone', 50) ?? DEFAULT_TIMEZONE;
    if (body.status === 'active' || body.status === 'inactive') branch.status = body.status;
    if (body.google_maps_url !== undefined) branch.google_maps_url = validateUrl(body.google_maps_url, 'google_maps_url');
    if (body.google_review_url !== undefined) branch.google_review_url = validateUrl(body.google_review_url, 'google_review_url');
    if (body.whatsapp_number !== undefined) branch.whatsapp_number = validateWhatsApp(body.whatsapp_number);
    if (body.operating_hours !== undefined) branch.operating_hours = this.hours(body.operating_hours, 'Opening hours', false) as any;
    if (body.ramadan_hours !== undefined) branch.ramadan_hours = this.hours(body.ramadan_hours, 'Ramadan hours', true);
    if (body.amenities !== undefined) branch.amenities = amenities(body.amenities);
    if (body.delivery_links !== undefined) branch.delivery_links = validateLinks(body.delivery_links);
    return this.branches.save(branch);
  }

  async bulk(bodies: Dict[]) {
    const results = [];
    const existing = new Set();
    const branches = await this.branches.find();
    branches.forEach((b) => existing.add(b.name));

    for (const body of bodies) {
      const name = text(body.name, 'name', 120, true);
      if (!name) continue;
      if (existing.has(name)) {
        results.push({ name, status: 'skipped', reason: 'duplicate' });
        continue;
      }
      try {
        const branch = await this.create(body);
        results.push({ name: branch.name, status: 'created', id: branch.id });
        existing.add(name);
      } catch (err) {
        results.push({ name, status: 'error', reason: String(err).slice(0, 100) });
      }
    }
    return { created: results.filter((r) => r.status === 'created').length, results };
  }
}
