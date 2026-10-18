import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CareersService, MAX_CV_BYTES } from './careers.service';

const B1 = '11111111-1111-1111-1111-111111111111';
const A1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const pdf = (size = 100) => ({ buffer: Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(Math.max(0, size - 8))]), originalname: 'My CV (final).pdf', size });

function setup(opts: { byPhone?: number; all?: number; row?: any } = {}) {
  const saved: any[] = [];
  const apps = {
    count: jest.fn(async ({ where }: any) => (where.phone ? (opts.byPhone ?? 0) : (opts.all ?? 0))),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => (saved.push(x), { id: A1, ...x })),
    update: jest.fn(async () => ({})),
    find: jest.fn(async () => [{ status: 'new' }, { status: 'closed' }]),
    findOne: jest.fn(async () => opts.row ?? null),
  };
  const branches = { findOne: jest.fn(async ({ where }: any) => (where.id === B1 ? { id: B1 } : null)) };
  return { svc: new CareersService(apps as any, branches as any), saved, apps };
}
const body = (x: Record<string, unknown> = {}) => ({ role: 'barista', name: ' Ali ', phone: '050 111 2222', experience_years: '2', ...x });

describe('CareersService', () => {
  it('saves an application with a PDF CV', async () => {
    const { svc, saved, apps } = setup();
    expect(await svc.apply(body({ branch_id: B1, email: 'ALI@x.com' }), pdf())).toEqual({ ok: true, id: A1 });
    expect(saved[0]).toMatchObject({ role: 'barista', name: 'Ali', phone: '0501112222', email: 'ali@x.com', experience_years: 2, branch_id: B1, cv_type: 'application/pdf', cv_name: 'My CV _final_.pdf' });
    expect(apps.update).toHaveBeenCalled(); // old CVs purged
  });

  it('works without a CV and defaults unknown roles to other', async () => {
    const { svc, saved } = setup();
    await svc.apply(body({ role: 'ceo' }));
    expect(saved[0]).toMatchObject({ role: 'other' });
    expect(saved[0].cv).toBeUndefined();
  });

  it('refuses CVs that are too big or not PDF/Word', async () => {
    await expect(setup().svc.apply(body(), pdf(MAX_CV_BYTES + 1))).rejects.toThrow('2 MB');
    await expect(setup().svc.apply(body(), { buffer: Buffer.from('MZ\x90\x00 evil'), originalname: 'cv.pdf', size: 10 })).rejects.toThrow('PDF or Word');
    const docx = { buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2]), originalname: 'cv.docx', size: 6 };
    const { svc, saved } = setup();
    await svc.apply(body(), docx);
    expect(saved[0].cv_type).toContain('wordprocessingml');
  });

  it('validates details and limits repeats', async () => {
    await expect(setup().svc.apply(body({ name: ' ' }))).rejects.toThrow('name');
    await expect(setup().svc.apply(body({ phone: '12' }))).rejects.toThrow('mobile');
    await expect(setup().svc.apply(body({ email: 'nope' }))).rejects.toThrow('email');
    await expect(setup().svc.apply(body({ experience_years: 99 }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup().svc.apply(body({ branch_id: '22222222-2222-2222-2222-222222222222' }))).rejects.toThrow('branch');
    await expect(setup({ byPhone: 2 }).svc.apply(body())).rejects.toThrow('already have');
    await expect(setup({ all: 40 }).svc.apply(body())).rejects.toThrow('tomorrow');
  });

  it('lets staff list, move and download', async () => {
    expect((await setup().svc.list()).new).toBe(1);
    const row: any = { id: A1, status: 'new', cv: Buffer.from('%PDF'), cv_name: 'a.pdf', cv_type: 'application/pdf' };
    expect(await setup({ row }).svc.setStatus(A1, 'shortlisted')).toEqual({ ok: true, status: 'shortlisted' });
    await expect(setup({ row }).svc.setStatus(A1, 'hired')).rejects.toBeInstanceOf(BadRequestException);
    expect((await setup({ row }).svc.cv(A1)).name).toBe('a.pdf');
    await expect(setup({ row: { ...row, cv: null } }).svc.cv(A1)).rejects.toBeInstanceOf(NotFoundException);
  });
});
