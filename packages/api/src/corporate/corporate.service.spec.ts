import { BadRequestException } from '@nestjs/common';
import { CorporateService, monthRange, vatOf } from './corporate.service';

function setup(acc: any = null, used = 0) {
  const accounts = { findOne: jest.fn(async () => acc), create: jest.fn((o) => o), save: jest.fn(async (o) => o) };
  const qb: any = { select: () => qb, where: () => qb, getRawOne: async () => ({ sum: String(used) }) };
  const orders = { createQueryBuilder: () => qb };
  const svc = new CorporateService(accounts as any, {} as any, orders as any, {} as any, {} as any, {} as any);
  return { svc, accounts };
}
const TOKEN = 'a'.repeat(48);

describe('CorporateService', () => {
  it('takes the 5% VAT out of a VAT-inclusive total', () => {
    expect(vatOf(105)).toBe(5);
    expect(vatOf(1000)).toBe(47.62);
  });

  it('uses Dubai month boundaries', () => {
    const { from, to } = monthRange('2026-10');
    expect(from.toISOString()).toBe('2026-09-30T20:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-31T20:00:00.000Z');
    expect(() => monthRange('2026-13')).toThrow(BadRequestException);
  });

  it('checks applications, including the 15-digit TRN', async () => {
    const { svc, accounts } = setup();
    const ok = { company: 'Acme LLC', contact_name: 'Mona', email: 'mona@acme.ae', phone: '0501234567' };
    await expect(svc.apply({ ...ok, email: 'nope' })).rejects.toThrow('valid email');
    await expect(svc.apply({ ...ok, trn: '1234' })).rejects.toThrow('15 digits');
    await svc.apply({ ...ok, trn: '100-1234-5678-9012' });
    expect(accounts.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', trn: '100123456789012' }));
  });

  it('allows orders only for active accounts within the credit limit', async () => {
    await expect(setup(null).svc.forOrder(TOKEN, 10)).rejects.toThrow('not valid');
    await expect(setup({ id: 'a', status: 'paused', credit_limit: '500' }).svc.forOrder(TOKEN, 10)).rejects.toThrow('paused');
    await expect(setup({ id: 'a', status: 'active', credit_limit: '500' }, 480).svc.forOrder(TOKEN, 30)).rejects.toThrow('AED 20.00 left');
    await expect(setup({ id: 'a', status: 'active', credit_limit: '500', company: 'Acme' }, 400).svc.forOrder(TOKEN, 30)).resolves.toMatchObject({ company: 'Acme' });
  });

  it('creates the portal link when an account is first approved', async () => {
    const acc = { id: '11111111-1111-4111-8111-111111111111', status: 'pending', access_token: null, approved_at: null, credit_limit: '2000' };
    const { svc } = setup(acc);
    const r = await svc.update(acc.id, { status: 'active', credit_limit: 3000 });
    expect(r.access_token).toMatch(/^[a-f0-9]{48}$/);
    expect(r.credit_limit).toBe('3000');
  });
});
