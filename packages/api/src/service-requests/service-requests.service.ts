import { PushService } from '../push/push.service';
import { knownTable } from '../branches/known-table';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { ServiceRequest } from '../entities/service-request.entity';
import { Branch } from '../entities/branch.entity';

export interface StaffUser {
  id: string;
  role: string;
  assigned_branch_id?: string | null;
}

const TYPES = ['staff', 'bill'] as const;
const TABLE = /^[\w-]{1,20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A repeat press from the same table within this time reuses the open request.
const REPEAT_MS = 5 * 60_000;
// Most open requests one branch can have at once, so a script cannot flood the screen.
const MAX_OPEN = 40;

@Injectable()
export class ServiceRequestsService {
  constructor(
    @InjectRepository(ServiceRequest) private requests: Repository<ServiceRequest>,
    @InjectRepository(Branch) private branches: Repository<Branch>,
    @Optional() private push?: PushService,
  ) {}

  // Public: called from the menu opened by a table QR.
  async create(body: { branch_id?: unknown; table?: unknown; type?: unknown }) {
    const branchId = typeof body.branch_id === 'string' ? body.branch_id : '';
    const table = typeof body.table === 'string' ? body.table.trim() : '';
    const type = TYPES.find((t) => t === body.type);
    if (!UUID.test(branchId) || !TABLE.test(table) || !type) throw new BadRequestException('Scan the QR code on your table');
    const branch = await this.branches.findOne({ where: { id: branchId } });
    if (!branch || branch.status !== 'active') throw new BadRequestException('Scan the QR code on your table');
    if (!(await knownTable(this.branches.manager, branchId, table))) throw new BadRequestException('Scan the QR code on your table');

    const recent = await this.requests.findOne({
      where: { branch_id: branchId, table_number: table, type, status: 'open', created_at: MoreThanOrEqual(new Date(Date.now() - REPEAT_MS)) },
      order: { created_at: 'DESC' },
    });
    if (recent) return { ok: true, id: recent.id, repeated: true };
    if ((await this.requests.count({ where: { branch_id: branchId, status: 'open' } })) >= MAX_OPEN) {
      return { ok: false, message: 'Staff are busy right now. Please wave to a team member.' };
    }
    const saved = await this.requests.save(this.requests.create({ branch_id: branchId, table_number: table, type }));
    this.push?.sendToStaff(branchId, { title: `Table ${table}: ${type === 'bill' ? 'bill please' : 'needs a team member'}`, body: branch.name, url: '/' }).catch(() => undefined);
    return { ok: true, id: saved.id, repeated: false };
  }

  // Public: the customer's page checks whether staff have seen it. Needs the unguessable request id.
  async status(id: string) {
    if (!UUID.test(id)) throw new NotFoundException();
    const r = await this.requests.findOne({ where: { id } });
    if (!r) throw new NotFoundException();
    return { status: r.status };
  }

  private branchFor(raw: unknown, staff: StaffUser) {
    const branchId = typeof raw === 'string' ? raw : '';
    if (!UUID.test(branchId)) throw new BadRequestException('Choose a branch');
    if (staff.role !== 'admin' && staff.assigned_branch_id !== branchId) {
      throw new ForbiddenException('You can only see your own branch');
    }
    return branchId;
  }

  // Staff: open requests (oldest first) plus the last hour's finished ones.
  async list(branchRaw: unknown, staff: StaffUser) {
    const branchId = this.branchFor(branchRaw, staff);
    const [open, done] = await Promise.all([
      this.requests.find({ where: { branch_id: branchId, status: 'open' }, order: { created_at: 'ASC' }, take: MAX_OPEN }),
      this.requests.find({
        where: { branch_id: branchId, status: 'done', done_at: MoreThanOrEqual(new Date(Date.now() - 3600_000)) },
        order: { done_at: 'DESC' },
        take: 20,
      }),
    ]);
    const row = (r: ServiceRequest) => ({ id: r.id, table: r.table_number, type: r.type, status: r.status, created_at: r.created_at, done_at: r.done_at });
    return { open: open.map(row), done: done.map(row) };
  }

  async markDone(id: string, staff: StaffUser) {
    if (!UUID.test(id)) throw new NotFoundException('Request not found');
    const r = await this.requests.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    this.branchFor(r.branch_id, staff);
    if (r.status === 'open') {
      r.status = 'done';
      r.done_at = new Date();
      r.done_by = staff.id;
      await this.requests.save(r);
    }
    return { ok: true };
  }
}
