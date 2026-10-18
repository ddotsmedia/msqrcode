import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Branch } from '../entities/branch.entity';
import { BRANCH_SECTIONS, PERMISSIONS, permissionsOf } from './permissions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 10;
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

// Full admins manage who can sign in to the admin panel and what each person sees.
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Branch) private branches: Repository<Branch>,
  ) {}

  private view(u: User) {
    return {
      id: u.id,
      email: u.email,
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      phone: u.phone ?? '',
      role: u.role === 'admin' ? 'admin' : 'staff',
      permissions: permissionsOf(u),
      branch_id: u.assigned_branch_id ?? null,
      status: u.status,
      created_at: u.created_at,
    };
  }

  async list() {
    const rows = await this.users.find({ order: { created_at: 'ASC' } });
    return rows.map((u) => this.view(u));
  }

  private password(v: unknown) {
    const p = typeof v === 'string' ? v : '';
    if (p.length < MIN_PASSWORD || p.length > 128) throw new BadRequestException(`Password must be at least ${MIN_PASSWORD} characters`);
    return p;
  }

  // Role, sections and branch, checked together: custom users need at least one section, and a branch for branch sections.
  private async access(body: Record<string, unknown>, current?: User) {
    const role = body.role !== undefined ? (body.role === 'admin' ? 'admin' : body.role === 'staff' ? 'staff' : null) : current?.role === 'admin' ? 'admin' : 'staff';
    if (!role) throw new BadRequestException('Choose full admin or custom access');
    let permissions: string[] | null = null;
    let branch: string | null = body.branch_id !== undefined ? (typeof body.branch_id === 'string' && body.branch_id ? body.branch_id : null) : (current?.assigned_branch_id ?? null);
    if (role === 'staff') {
      const raw = body.permissions !== undefined ? body.permissions : current ? permissionsOf(current) : [];
      if (!Array.isArray(raw)) throw new BadRequestException('Choose what this person can see');
      permissions = PERMISSIONS.filter((p) => raw.includes(p));
      if (!permissions.length) throw new BadRequestException('Choose at least one section, or make this person a full admin');
      if (permissions.some((p) => (BRANCH_SECTIONS as string[]).includes(p)) && !branch) throw new BadRequestException('Choose the branch this person works at');
    }
    if (branch) {
      if (!UUID.test(branch) || !(await this.branches.findOne({ where: { id: branch } }))) throw new BadRequestException('Branch not found');
    }
    if (role === 'admin') branch = null; // full admins see every branch
    return { role, permissions, assigned_branch_id: branch };
  }

  async create(body: Record<string, unknown>) {
    const email = clean(body?.email, 255).toLowerCase();
    if (!EMAIL.test(email)) throw new BadRequestException('Enter a valid email');
    if (await this.users.findOne({ where: { email } })) throw new BadRequestException('A user with this email already exists');
    const access = await this.access(body ?? {});
    const row = this.users.create({
      email,
      password_hash: await bcrypt.hash(this.password(body?.password), 12),
      first_name: clean(body?.first_name, 60) || null,
      last_name: clean(body?.last_name, 60) || null,
      phone: clean(body?.phone, 20) || null,
      status: 'active',
      ...access,
    } as Partial<User>);
    return this.view(await this.users.save(row));
  }

  private async activeAdmins() {
    return this.users.count({ where: { role: 'admin', status: 'active' } });
  }

  async update(id: string, body: Record<string, unknown>, me: { id: string }) {
    const u = UUID.test(id) ? await this.users.findOne({ where: { id } }) : null;
    if (!u) throw new NotFoundException('User not found');
    const self = u.id === me.id;
    const wasActiveAdmin = u.role === 'admin' && u.status === 'active';

    if (body.email !== undefined) {
      const email = clean(body.email, 255).toLowerCase();
      if (!EMAIL.test(email)) throw new BadRequestException('Enter a valid email');
      const other = await this.users.findOne({ where: { email } });
      if (other && other.id !== u.id) throw new BadRequestException('A user with this email already exists');
      u.email = email;
    }
    if (body.first_name !== undefined) u.first_name = clean(body.first_name, 60) || (null as any);
    if (body.last_name !== undefined) u.last_name = clean(body.last_name, 60) || (null as any);
    if (body.phone !== undefined) u.phone = clean(body.phone, 20) || (null as any);
    if (body.role !== undefined || body.permissions !== undefined || body.branch_id !== undefined) {
      if (self && body.role !== undefined && body.role !== u.role) throw new ForbiddenException('You cannot change your own access');
      Object.assign(u, await this.access(body, u));
    }
    if (body.status !== undefined) {
      if (!['active', 'inactive'].includes(String(body.status))) throw new BadRequestException('Unknown status');
      if (self && body.status !== 'active') throw new ForbiddenException('You cannot switch off your own account');
      u.status = String(body.status);
    }
    if (body.password !== undefined && body.password !== '') u.password_hash = await bcrypt.hash(this.password(body.password), 12);

    // Never leave the panel without an active full admin.
    if (wasActiveAdmin && !(u.role === 'admin' && u.status === 'active') && (await this.activeAdmins()) <= 1) {
      throw new BadRequestException('Keep at least one active full admin');
    }
    return this.view(await this.users.save(u));
  }
}
