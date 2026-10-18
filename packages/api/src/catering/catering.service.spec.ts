import { BadRequestException } from '@nestjs/common';
import { CateringService } from './catering.service';

const B1 = '11111111-1111-1111-1111-111111111111';
const future = () => new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);

function setup(opts: { byPhone?: number; all?: number; row?: any } = {}) {
  const saved: any[] = [];
  const requests = {
    count: jest.fn(async ({ where }: any) => (where.phone ? opts.byPhone ?? 0 : opts.all ?? 0)),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => {
      saved.push(x);
      return { id: 'r1', ...x };
    }),
    find: jest.fn(async () => [{ status: 'new' }, { status: 'closed' }]),
    findOne: jest.fn(async () => opts.row ?? null),
  };
  const branches = { findOne: jest.fn(async ({ where }: any) => (where.id === B1 ? { id: B1 } : null)) };
  return { svc: new CateringService(requests as any, branches as any), saved };
}

const body = (extra: Record<string, unknown> = {}) => ({
  kind: 'cart',
  name: '  Huda  ',
  phone: '+971 50 111 2222',
  email: 'Huda@Example.com',
  company: 'Acme',
  event_date: future(),
  guests: '60',
  location: 'Al Reem Island',
  branch_id: B1,
  message: 'Coffee cart for a product launch',
  ...extra,
});

describe('CateringService', () => {
  it('saves a cleaned-up enquiry', async () => {
    const { svc, saved } = setup();
    expect(await svc.create(body())).toEqual({ ok: true, id: 'r1' });
    expect(saved[0]).toMatchObject({ kind: 'cart', name: 'Huda', phone: '+971501112222', email: 'huda@example.com', guests: 60, branch_id: B1 });
  });

  it('rejects missing details, past dates, bad guests and unknown branches', async () => {
    await expect(setup().svc.create(body({ name: '' }))).rejects.toThrow('name');
    await expect(setup().svc.create(body({ phone: '12' }))).rejects.toThrow('mobile');
    await expect(setup().svc.create(body({ email: 'nope' }))).rejects.toThrow('email');
    await expect(setup().svc.create(body({ event_date: '2020-01-01' }))).rejects.toThrow('date');
    await expect(setup().svc.create(body({ guests: 2 }))).rejects.toThrow('Guests');
    await expect(setup().svc.create(body({ branch_id: '22222222-2222-2222-2222-222222222222' }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('treats an unknown kind as other and an empty email as none', async () => {
    const { svc, saved } = setup();
    await svc.create(body({ kind: 'party', email: '' }));
    expect(saved[0]).toMatchObject({ kind: 'other', email: null });
  });

  it('limits repeat enquiries from one phone and floods', async () => {
    await expect(setup({ byPhone: 3 }).svc.create(body())).rejects.toThrow('already have your request');
    await expect(setup({ all: 100 }).svc.create(body())).rejects.toThrow('call or WhatsApp');
  });

  it('counts new enquiries and changes status', async () => {
    expect((await setup().svc.list()).new).toBe(1);
    const row = { id: '33333333-3333-3333-3333-333333333333', status: 'new' };
    expect(await setup({ row }).svc.setStatus(row.id, 'contacted')).toEqual({ ok: true, status: 'contacted' });
    await expect(setup({ row }).svc.setStatus(row.id, 'lost')).rejects.toBeInstanceOf(BadRequestException);
  });
});
