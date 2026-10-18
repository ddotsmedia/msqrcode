import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GroupOrdersService, cleanLines } from './group-orders.service';

const P = '11111111-1111-4111-8111-111111111111';
const line = (over: any = {}) => ({ product_id: P, name: 'Latte', qty: 1, unit: 18, choices: { size: 'Large' }, labels: ['Large'], note: '', ...over });

function setup() {
  let row: any = null;
  const groups: any = {
    findOne: jest.fn(async () => row),
    create: jest.fn((o) => o),
    save: jest.fn(async (o) => (row = { ...o, status: o.status ?? 'open' })),
    update: jest.fn(async (where: any, patch: any) => {
      if (where.status && row.status !== where.status) return { affected: 0 };
      Object.assign(row, patch);
      return { affected: 1 };
    }),
    createQueryBuilder: () => ({ addSelect: function () { return this; }, where: function () { return this; }, getOne: async () => row }),
  };
  const branches = { findOne: jest.fn(async () => ({ id: 'b', name: 'Khalidiya', status: 'active', pickup_enabled: true })) };
  const orders = { findOne: jest.fn(async () => null) };
  const ordersService = { create: jest.fn(async (body: any) => ({ id: 'o1', access_token: 't', order_no: '012', total: 36, body })) };
  const svc = new GroupOrdersService(groups, branches as any, orders as any, ordersService as any);
  return { svc, ordersService, get: () => row };
}

describe('GroupOrdersService', () => {
  it('checks each line', () => {
    expect(() => cleanLines([line({ qty: 0 })])).toThrow(BadRequestException);
    expect(() => cleanLines(Array.from({ length: 11 }, () => line()))).toThrow('Up to 10');
    expect(cleanLines([line({ note: '  oat   milk ' })])[0].note).toBe('oat milk');
  });

  it('lets each person add, change and remove only their own items', async () => {
    const { svc, get } = setup();
    const { code, host_key } = await svc.create({ branch_id: 'b2a1d9a8-1111-4111-8111-111111111111', host_name: 'Mona', host_phone: '0501234567' });
    await svc.setItems(code, { name: 'Mona', member_key: host_key, lines: [line()] });
    const sara = await svc.setItems(code, { name: 'Sara', lines: [line({ name: 'Mocha', unit: 20 })] });
    expect(get().members).toHaveLength(2);
    expect(sara.group.total).toBe(38);
    expect(sara.group.members.find((m: any) => m.mine)?.name).toBe('Sara');
    await svc.setItems(code, { name: 'Sara', member_key: sara.member_key, lines: [line({ qty: 2, unit: 20 })] });
    expect(get().members).toHaveLength(2);
    await svc.setItems(code, { member_key: sara.member_key, lines: [] });
    expect(get().members.map((m: any) => m.name)).toEqual(['Mona']);
  });

  it('only the host sends, once, as one pickup order with names in the notes', async () => {
    const { svc, ordersService } = setup();
    const { code, host_key } = await svc.create({ branch_id: 'b2a1d9a8-1111-4111-8111-111111111111', host_name: 'Mona', host_phone: '0501234567' });
    await svc.setItems(code, { name: 'Sara', lines: [line({ note: 'extra hot' })] });
    await expect(svc.submit(code, { host_key: 'f'.repeat(32) })).rejects.toThrow(ForbiddenException);
    await svc.submit(code, { host_key, pickup_at: new Date().toISOString() });
    expect(ordersService.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'pickup', items: [expect.objectContaining({ note: 'Sara: extra hot' })] }));
    await expect(svc.submit(code, { host_key })).rejects.toThrow('already sent');
  });

  it('reopens the group if the order is refused', async () => {
    const { svc, ordersService, get } = setup();
    const { code, host_key } = await svc.create({ branch_id: 'b2a1d9a8-1111-4111-8111-111111111111', host_name: 'Mona', host_phone: '0501234567' });
    await svc.setItems(code, { name: 'Sara', lines: [line()] });
    ordersService.create.mockRejectedValueOnce(new BadRequestException('Latte is sold out right now'));
    await expect(svc.submit(code, { host_key })).rejects.toThrow('sold out');
    expect(get().status).toBe('open');
  });
});
