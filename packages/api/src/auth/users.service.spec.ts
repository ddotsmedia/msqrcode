import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';

const B = '22222222-2222-4222-8222-222222222222';
function setup(rows: any[]) {
  const users = {
    find: jest.fn(async () => rows),
    findOne: jest.fn(async ({ where }: any) => rows.find((r) => (where.id ? r.id === where.id : r.email === where.email)) ?? null),
    count: jest.fn(async ({ where }: any) => rows.filter((r) => r.role === where.role && r.status === where.status).length),
    create: jest.fn((o) => ({ id: 'new', created_at: new Date(), ...o })),
    save: jest.fn(async (o) => o),
  };
  const branches = { findOne: jest.fn(async ({ where }: any) => (where.id === B ? { id: B } : null)) };
  return new UsersService(users as any, branches as any);
}
const admin = () => ({ id: '11111111-1111-4111-8111-111111111111', email: 'a@x.ae', role: 'admin', status: 'active', permissions: null });

describe('UsersService', () => {
  it('creates a custom user with only known sections, and requires a branch for branch sections', async () => {
    const svc = setup([admin()]);
    await expect(svc.create({ email: 'k@x.ae', password: 'longenough1', role: 'staff', permissions: ['kitchen'] })).rejects.toThrow('branch');
    const u = await svc.create({ email: 'K@x.ae', password: 'longenough1', role: 'staff', permissions: ['kitchen', 'hacker'], branch_id: B });
    expect(u).toMatchObject({ email: 'k@x.ae', role: 'staff', permissions: ['kitchen'], branch_id: B });
    const c = await svc.create({ email: 'c@x.ae', password: 'longenough1', role: 'staff', permissions: ['catering'] });
    expect(c.branch_id).toBeNull();
  });

  it('checks passwords, emails and empty access', async () => {
    const svc = setup([admin()]);
    await expect(svc.create({ email: 'k@x.ae', password: 'short', role: 'admin' })).rejects.toThrow('at least 10');
    await expect(svc.create({ email: 'a@x.ae', password: 'longenough1', role: 'admin' })).rejects.toThrow('already exists');
    await expect(svc.create({ email: 'z@x.ae', password: 'longenough1', role: 'staff', permissions: [] })).rejects.toThrow('at least one section');
  });

  it('never leaves the panel without an active full admin, and stops self-lockout', async () => {
    const a = admin();
    const svc = setup([a]);
    await expect(svc.update(a.id, { status: 'inactive' }, { id: a.id })).rejects.toThrow(ForbiddenException);
    await expect(svc.update(a.id, { role: 'staff', permissions: ['catering'] }, { id: 'someone-else' })).rejects.toThrow(BadRequestException);
  });
});
