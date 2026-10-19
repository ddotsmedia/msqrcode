// Cart kept on the phone (survives app restarts). Prices shown here are estimates; the server prices the order.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ProductFull } from './types';

export type CartLine = {
  key: string;
  product_id: string;
  name: string;
  base_price: number;
  qty: number;
  choices: Record<string, string>; // option-group id -> chosen name
  choiceLabels: string[];
  adjustment: number;
  note: string;
};

type Cart = {
  lines: CartLine[];
  add: (p: ProductFull, qty: number, choices: Record<string, string>, note: string) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const KEY = 'msq_cart';
const Ctx = createContext<Cart | null>(null);

// Works out the price adjustment and labels for the picked options.
export function priceChoices(p: ProductFull, picked: Record<string, string>) {
  let adjustment = 0;
  const labels: string[] = [];
  for (const g of [...(p.variants ?? []), ...(p.option_groups ?? [])]) {
    const list = g.options?.choices ?? [];
    if (!list.length) continue;
    const chosen = list.find((c) => c.name === picked[g.id]) ?? list[0];
    adjustment += Number(chosen.price_adjustment) || 0;
    labels.push(chosen.name);
  }
  return { adjustment, labels };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setLines(JSON.parse(raw)))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(lines)).catch(() => undefined);
  }, [lines, ready]);

  const value = useMemo<Cart>(() => {
    const subtotal = lines.reduce((s, l) => s + (l.base_price + l.adjustment) * l.qty, 0);
    return {
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: Math.round(subtotal * 100) / 100,
      add: (p, qty, choices, note) => {
        const { adjustment, labels } = priceChoices(p, choices);
        const key = `${p.id}:${JSON.stringify(choices)}:${note}`;
        setLines((prev) => {
          const same = prev.find((l) => l.key === key);
          if (same) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
          return [...prev, { key, product_id: p.id, name: p.name, base_price: Number(p.base_price), qty, choices, choiceLabels: labels, adjustment, note }];
        });
      },
      setQty: (key, qty) => setLines((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty } : l)))),
      remove: (key) => setLines((prev) => prev.filter((l) => l.key !== key)),
      clear: () => setLines([]),
    };
  }, [lines]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCart must be used inside CartProvider');
  return v;
}
