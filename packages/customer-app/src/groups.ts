// Group orders: the phone remembers the groups it started or joined, with the keys that let it edit them.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API } from './api';

export type SavedGroup = { code: string; memberKey: string; hostKey?: string; name: string };
const KEY = 'msq_groups';

export async function getGroups(): Promise<SavedGroup[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
  } catch {
    return [];
  }
}
export async function saveGroup(g: SavedGroup) {
  const all = (await getGroups()).filter((x) => x.code !== g.code);
  await AsyncStorage.setItem(KEY, JSON.stringify([g, ...all].slice(0, 20)));
}
export async function findGroup(code: string) {
  return (await getGroups()).find((g) => g.code === code) ?? null;
}

export async function groupCall(path: string, method: 'GET' | 'POST' | 'PUT', body?: object) {
  const res = await fetch(`${API}/group-orders${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(Array.isArray(json.message) ? json.message[0] : json.message || 'Something went wrong');
  return json;
}
