import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';

const B1 = '11111111-1111-1111-1111-111111111111';
const B2 = '22222222-2222-2222-2222-222222222222';

function setup(opts: { recent?: boolean; openCount?: number; status?: string } = {}) {
  const saved: any[] = [];
  const stored: any = { id: '33333333-3333-3333-3333-333333333333', branch_id: B1, status: 'open' };
  const requests = {
    findOne: jest.fn(async ({ where }: any) => (where.table_number ? (opts.recent ? { id: 'old' } : null) : stored)),
    count: jest.fn(async () => opts.openCount ?? 0),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => {
      saved.push(x);
      return { id: 'new', ...x };
    }),
    find: jest.fn(async () => []),
  };
  const branches = { findOne: jest.fn(async ({ where }: any) => (where.id === B1 ? { id: B1, status: opts.status ?? 'active' } : null)) };
  return { svc: new ServiceRequestsService(requests as any, branches as any), saved, stored };
}

describe('ServiceRequestsService', () => {
  it('creates a request for a table', async () => {
    const { svc, saved } = setup();
    expect(await svc.create({ branch_id: B1, table: '12', type: 'bill' })).toEqual({ ok: true, id: 'new', repeated: false });
    expect(saved[0]).toMatchObject({ branch_id: B1, table_number: '12', type: 'bill' });
  });

  it('reuses an open request from the same table instead of making a new one', async () => {
    const { svc, saved } = setup({ recent: true });
    expect(await svc.create({ branch_id: B1, table: '12', type: 'staff' })).toMatchObject({ ok: true, id: 'old', repeated: true });
    expect(saved).toHaveLength(0);
  });

  it('rejects bad input, unknown or inactive branches', async () => {
    await expect(setup().svc.create({ branch_id: B1, table: '<x>', type: 'staff' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup().svc.create({ branch_id: B1, table: '1', type: 'food' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup().svc.create({ branch_id: B2, table: '1', type: 'staff' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup({ status: 'inactive' }).svc.create({ branch_id: B1, table: '1', type: 'staff' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps open requests per branch', async () => {
    const { svc, saved } = setup({ openCount: 40 });
    expect((await svc.create({ branch_id: B1, table: '1', type: 'staff' })).ok).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it('lets staff close requests only for their own branch', async () => {
    const { svc, stored } = setup();
    await expect(svc.markDone(stored.id, { id: 'u', role: 'branch_manager', assigned_branch_id: B2 })).rejects.toBeInstanceOf(ForbiddenException);
    await svc.markDone(stored.id, { id: 'u', role: 'branch_manager', assigned_branch_id: B1 });
    expect(stored).toMatchObject({ status: 'done', done_by: 'u' });
  });
});
