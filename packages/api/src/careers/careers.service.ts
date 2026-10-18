import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { JobApplication, JobRole, JobStatus } from '../entities/job-application.entity';
import { Branch } from '../entities/branch.entity';

const ROLES: JobRole[] = ['barista', 'shift_lead', 'kitchen', 'cashier', 'other'];
const STATUSES: JobStatus[] = ['new', 'shortlisted', 'closed'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MAX_CV_BYTES = 2 * 1024 * 1024;
const PER_PHONE_DAY = 2;
const PER_DAY = 40;
// CVs are personal data: removed six months after the application.
const KEEP_CV_DAYS = 180;

// PDF, Word (.docx is a zip) or old Word (.doc), checked by the file's first bytes, not its name.
const CV_TYPES: { type: string; magic: number[] }[] = [
  { type: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: [0x50, 0x4b, 0x03, 0x04] },
  { type: 'application/msword', magic: [0xd0, 0xcf, 0x11, 0xe0] },
];
export interface CvFile {
  buffer: Buffer;
  originalname?: string;
  size: number;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

@Injectable()
export class CareersService {
  constructor(
    @InjectRepository(JobApplication) private apps: Repository<JobApplication>,
    @InjectRepository(Branch) private branches: Repository<Branch>,
  ) {}

  // Public: job application from the website, with an optional CV.
  async apply(body: Record<string, unknown>, file?: CvFile) {
    const role = ROLES.find((r) => r === body.role) ?? 'other';
    const name = clean(body.name, 80);
    const phone = clean(body.phone, 20).replace(/[^\d+]/g, '');
    const email = clean(body.email, 120).toLowerCase();
    const years = Math.floor(Number(body.experience_years) || 0);
    if (!name) throw new BadRequestException('Please enter your name');
    if (phone.replace(/\D/g, '').length < 7) throw new BadRequestException('Please enter a mobile number we can call');
    if (email && !EMAIL.test(email)) throw new BadRequestException('That email address does not look right');
    if (!(years >= 0 && years <= 40)) throw new BadRequestException('Years of experience must be between 0 and 40');
    const branchId = typeof body.branch_id === 'string' && UUID.test(body.branch_id) ? body.branch_id : null;
    if (branchId && !(await this.branches.findOne({ where: { id: branchId } }))) throw new BadRequestException('Choose a branch from the list');

    let cv: { cv: Buffer; cv_type: string; cv_name: string } | null = null;
    if (file && file.size > 0) {
      if (file.size > MAX_CV_BYTES) throw new BadRequestException('Your CV must be smaller than 2 MB');
      const kind = CV_TYPES.find((t) => t.magic.every((b, i) => file.buffer[i] === b));
      if (!kind) throw new BadRequestException('Please attach your CV as a PDF or Word file');
      cv = { cv: file.buffer, cv_type: kind.type, cv_name: clean(file.originalname, 120).replace(/[^\w.\- ]/g, '_') || 'cv' };
    }

    const dayAgo = new Date(Date.now() - 24 * 3600_000);
    const [byPhone, all] = await Promise.all([
      this.apps.count({ where: { phone, created_at: MoreThanOrEqual(dayAgo) } }),
      this.apps.count({ where: { created_at: MoreThanOrEqual(dayAgo) } }),
    ]);
    if (byPhone >= PER_PHONE_DAY) throw new BadRequestException('We already have your application. Thank you!');
    if (all >= PER_DAY) throw new BadRequestException('We have many applications today. Please try again tomorrow.');

    const saved = await this.apps.save(
      this.apps.create({
        role,
        name,
        phone,
        email: email || null,
        experience_years: years,
        branch_id: branchId,
        message: clean(body.message, 1000) || null,
        ...(cv ?? {}),
      }),
    );
    await this.purgeOldCvs();
    return { ok: true, id: saved.id };
  }

  private async purgeOldCvs() {
    await this.apps.update(
      { created_at: LessThan(new Date(Date.now() - KEEP_CV_DAYS * 864e5)), cv_name: Not(IsNull()) },
      { cv: null, cv_name: null, cv_type: null },
    );
  }

  // Staff: newest first.
  async list(statusRaw?: unknown) {
    const status = STATUSES.filter((s) => s === statusRaw);
    const rows = await this.apps.find({ where: status.length ? { status: In(status) } : undefined, order: { created_at: 'DESC' }, take: 200 });
    return { new: rows.filter((r) => r.status === 'new').length, rows };
  }

  async setStatus(id: string, statusRaw: unknown) {
    const status = STATUSES.find((s) => s === statusRaw);
    if (!status) throw new BadRequestException('Unknown status');
    const row = UUID.test(id) ? await this.apps.findOne({ where: { id } }) : null;
    if (!row) throw new NotFoundException();
    row.status = status;
    await this.apps.save(row);
    return { ok: true, status };
  }

  async cv(id: string) {
    const row = UUID.test(id) ? await this.apps.findOne({ where: { id }, select: ['id', 'cv', 'cv_name', 'cv_type'] }) : null;
    if (!row?.cv) throw new NotFoundException('No CV for this application');
    return { data: row.cv, name: row.cv_name ?? 'cv', type: row.cv_type ?? 'application/octet-stream' };
  }
}
