// The table this phone is ordering from (set by scanning the table QR code).
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TableSession = { branchId: string; table: string };
const KEY = 'msq_table';

export async function getTable(): Promise<TableSession | null> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || 'null');
  } catch {
    return null;
  }
}
export const setTable = (t: TableSession) => AsyncStorage.setItem(KEY, JSON.stringify(t));
export const clearTable = () => AsyncStorage.removeItem(KEY);

// Reads the table QR link (?branch=<id>&table=<n>), the same format the website uses.
export function parseTableCode(text: string): TableSession | null {
  const branch = text.match(/[?&]branch=([a-f0-9-]{36})/i);
  const table = text.match(/[?&;]table[=:]([\w-]{1,20})/i);
  if (!branch || !table) return null;
  return { branchId: branch[1], table: table[1] };
}
