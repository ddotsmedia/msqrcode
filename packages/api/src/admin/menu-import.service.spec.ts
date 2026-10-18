import { MenuImportService } from './menu-import.service';

const svc = () => new MenuImportService({} as any, {} as any, {} as any) as any;

describe('menu import file reading', () => {
  it('reads the Excel template it writes, keeping known columns only', async () => {
    const s = svc();
    const buf = await s.template();
    const rows = await s.parseFile(buf, 'menu.XLSX');
    expect(rows).toEqual([
      { category: 'Espresso', name: 'Americano', description: 'Double espresso with hot water', price_aed: 12, dietary_tags: 'vegan', display_order: 1, branch_codes: 'ALL' },
    ]);
  });

  it('reads CSV and ignores unknown or dangerous columns', async () => {
    const csv = 'name,price_aed,__proto__,constructor\nLatte,18,polluted,x\n';
    const rows = await svc().parseFile(Buffer.from(csv), 'menu.csv');
    expect(rows).toEqual([{ name: 'Latte', price_aed: '18' }]);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('refuses broken Excel files and other formats', async () => {
    await expect(svc().parseFile(Buffer.from('not a zip'), 'x.xlsx')).rejects.toThrow('Could not read');
    await expect(svc().parseFile(Buffer.from('x'), 'x.pdf')).rejects.toThrow('Unsupported');
    await expect(svc().parseFile(Buffer.from('a,b\n"x,1\n'), 'x.csv')).rejects.toThrow('Could not read that CSV');
  });
});
