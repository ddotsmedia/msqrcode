import { EntityManager } from 'typeorm';
import { QrCode } from '../entities/qr-code.entity';

// True when the table can order or call staff. Once a branch has table QR codes, only those tables count,
// so made-up table numbers cannot flood the counter screen. Branches without table QR codes keep working as before.
export async function knownTable(manager: EntityManager | undefined, branchId: string, table: string): Promise<boolean> {
  const repo = manager?.getRepository?.(QrCode);
  if (!repo) return true;
  const tables = await repo.find({ where: { branch_id: branchId, kind: 'table', is_active: true }, select: { table_number: true } });
  if (!tables.length) return true;
  const want = table.trim().toLowerCase();
  return tables.some((t) => (t.table_number ?? '').trim().toLowerCase() === want);
}
