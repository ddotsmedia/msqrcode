// Placing and tracking orders with the live API. The server returns a private token per order; it is
// stored on the phone so the customer can check progress later.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API } from './api';
import type { CartLine } from './cart';

export type SavedOrder = { id: string; access_token: string; order_no: string; total: number; created_at: string };

const KEY = 'msq_orders';

export async function getSavedOrders(): Promise<SavedOrder[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
  } catch {
    return [];
  }
}

async function saveOrder(o: SavedOrder) {
  const all = await getSavedOrders();
  await AsyncStorage.setItem(KEY, JSON.stringify([o, ...all].slice(0, 30)));
}

// Next pickup slot: at least 15 minutes from now, on a 15-minute boundary.
export function nextPickupTime(): string {
  const slot = 15 * 60_000;
  return new Date(Math.ceil((Date.now() + 15 * 60_000) / slot) * slot).toISOString();
}

export async function placeOrder(input: {
  branchId: string;
  name: string;
  phone: string;
  lines: CartLine[];
  loyaltyToken?: string | null;
  table?: string | null; // set when ordering from a table; otherwise a pickup order
}) {
  const common = {
    branch_id: input.branchId,
    customer_name: input.name,
    phone: input.phone || undefined,
    loyalty_token: input.loyaltyToken || undefined,
    items: input.lines.map((l) => ({ product_id: l.product_id, qty: l.qty, choices: l.choices, note: l.note || undefined })),
  };
  const body = input.table
    ? { ...common, table: input.table }
    : { ...common, type: 'pickup', pickup_at: nextPickupTime() };
  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(Array.isArray(json.message) ? json.message[0] : json.message || 'Could not place the order');
  const saved: SavedOrder = {
    id: json.id,
    access_token: json.access_token,
    order_no: json.order_no,
    total: json.total,
    created_at: new Date().toISOString(),
  };
  await saveOrder(saved);
  return saved;
}

export type TrackedOrder = {
  id: string;
  order_no: string;
  status: string;
  pickup_at: string | null;
  total: number;
  items: { name: string; qty: number; options?: { choices?: { group: string; choice: string }[]; note?: string | null } }[];
};

export async function trackOrder(id: string, token: string): Promise<TrackedOrder> {
  const res = await fetch(`${API}/orders/${id}?token=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Order not found');
  return res.json();
}

// Table service: call a member of staff or ask for the bill. Staff see it on the counter screen.
export async function requestService(branchId: string, table: string, kind: 'staff' | 'bill') {
  const res = await fetch(`${API}/service-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ branch_id: branchId, table, type: kind }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.message || 'Could not send your request');
  return json.id as string;
}
