// Combo deals: a set of 2–4 menu items sold together for one price. Kept in step with api/src/promotions/combos.ts.
export interface Combo {
  title: string;
  combo_product_ids?: string[] | null;
  combo_price?: number | string | null;
}
export interface ComboLine {
  product_id: string;
  unit: number; // price of one, after any happy-hour discount
  qty: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

// Applies each combo as many times as the order holds a full set (cheapest units first, best saving first).
// A combo only ever lowers the price, never raises it.
export function comboSavings(lines: ComboLine[], combos: Combo[]) {
  const units = new Map<string, number[]>();
  for (const l of lines) for (let i = 0; i < l.qty; i++) units.set(l.product_id, [...(units.get(l.product_id) ?? []), Number(l.unit)]);
  units.forEach((u) => u.sort((a, b) => a - b));
  const valid = combos
    .map((c) => ({ title: c.title, ids: [...new Set((c.combo_product_ids ?? []).filter(Boolean))], price: Number(c.combo_price) }))
    .filter((c) => c.ids.length >= 2 && c.price > 0);
  const setPrice = (ids: string[]) => ids.reduce((s, id) => s + (units.get(id)?.[0] ?? Infinity), 0);
  const applied: { title: string; sets: number; amount: number }[] = [];
  for (;;) {
    const best = valid
      .map((c) => ({ c, save: setPrice(c.ids) - c.price }))
      .filter((x) => Number.isFinite(x.save) && x.save > 0)
      .sort((a, b) => b.save - a.save)[0];
    if (!best) break;
    best.c.ids.forEach((id) => units.get(id)!.shift());
    const hit = applied.find((a) => a.title === best.c.title);
    if (hit) {
      hit.sets += 1;
      hit.amount = round(hit.amount + best.save);
    } else applied.push({ title: best.c.title, sets: 1, amount: round(best.save) });
  }
  return { amount: round(applied.reduce((s, a) => s + a.amount, 0)), applied };
}
