import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GiftCardsService, normCode } from './gift-cards.service';

function setup(rows: any[] = []) {
  const cards = {
    findOne: jest.fn(async ({ where }: any) => rows.find((r) => r.code === where.code) ?? null),
    create: jest.fn((o) => o),
    save: jest.fn(async (o) => {
      if (!rows.includes(o)) rows.push(o);
      return o;
    }),
    find: jest.fn(async () => rows),
  };
  const uses = { find: jest.fn(async () => []) };
  const query = jest.fn();
  const m = { query, findOne: jest.fn(async () => ({ balance: '60.00' })), create: jest.fn((_e, o) => o), save: jest.fn(async (o) => o) };
  const db = { transaction: jest.fn(async (fn: any) => fn(m)) };
  return { svc: new GiftCardsService(cards as any, uses as any, db as any), rows, query };
}

describe('GiftCardsService', () => {
  it('reads codes typed with dashes, spaces or from the QR', () => {
    expect(normCode('gift-abcd-2345')).toBe('ABCD2345');
    expect(normCode('MSQ-GIFT:ABCD2345')).toBe('ABCD2345');
  });

  it('online requests start unpaid and need a phone', async () => {
    const { svc } = setup();
    await expect(svc.request({ amount: 100, buyer_name: 'Sara' })).rejects.toThrow(BadRequestException);
    const g = await svc.request({ amount: 100, buyer_name: 'Sara', buyer_phone: '050 123 4567', design: 'eid', recipient_name: 'Omar' });
    expect(g.status).toBe('pending');
    expect(g.code).toMatch(/^[A-Z2-9]{8}$/);
    expect(g).not.toHaveProperty('buyer_phone');
  });

  it('rejects amounts out of range', async () => {
    const { svc } = setup();
    await expect(svc.issue({ amount: 5, buyer_name: 'A' }, { role: 'admin' })).rejects.toThrow(BadRequestException);
    await expect(svc.issue({ amount: 99999, buyer_name: 'A' }, { role: 'admin' })).rejects.toThrow(BadRequestException);
  });

  it('activates once, then spends in parts', async () => {
    const { svc, rows, query } = setup();
    const g = await svc.request({ amount: 100, buyer_name: 'Sara', buyer_phone: '0501234567' });
    await expect(svc.redeem(g.code, 10, { role: 'admin' })).rejects.toThrow('not been paid');
    const a = await svc.activate(g.code, { role: 'branch_manager', assigned_branch_id: 'b1', id: 'u1' });
    expect(a.status).toBe('active');
    expect(a.expires_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(svc.activate(g.code, { role: 'admin' })).rejects.toThrow('already active');
    query.mockResolvedValueOnce([[{ balance: '60.00' }], 1]);
    const r = await svc.redeem(g.code, 40, { role: 'branch_manager', assigned_branch_id: 'b1' });
    expect(r).toMatchObject({ ok: true, taken: 40, balance: 60 });
    query.mockResolvedValueOnce([[], 0]);
    await expect(svc.redeem(g.code, 500, { role: 'branch_manager', assigned_branch_id: 'b1' })).rejects.toThrow('Only AED');
    expect(rows).toHaveLength(1);
  });

  it('unknown codes are not found', async () => {
    const { svc } = setup();
    await expect(svc.publicGet('ZZZZZZZZ')).rejects.toThrow(NotFoundException);
  });
});
