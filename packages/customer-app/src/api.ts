// Every screen reads the same live API the website uses.
export const SITE = 'https://coffeesales.ae';
export const API = `${SITE}/api`;

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export type Category = { id: string; name: string; display_order?: number };
export type Product = {
  id: string;
  name: string;
  description: string;
  category_id: string;
  base_price: number | string;
  image_url: string | null;
  status: string;
  is_popular?: boolean;
  is_new?: boolean;
};
export type Branch = { id: string; name: string; code?: string; address?: string; is_open?: boolean };
export type Promotion = { id: string; title: string; description?: string; ends_at?: string };
export type LoyaltyCard = { token: string; stamps?: number; points?: number; name?: string };

export const money = (v: number | string) => `AED ${Number(v).toFixed(2)}`;
