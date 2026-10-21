// Turns a past order back into cart lines. Option choices are stored by group name and choice name,
// so they are matched against the product's current option groups before the line is added.
import { getJson } from './api';
import type { OptionSet, ProductFull } from './types';
import type { TrackedOrder } from './orders';

export type ReorderPlan = {
  lines: { product: ProductFull; qty: number; choices: Record<string, string>; note: string }[];
  unavailable: string[]; // item names no longer on the menu
  changed: string[]; // item names where an option no longer exists and the default was used
};

export async function planReorder(order: TrackedOrder): Promise<ReorderPlan> {
  const plan: ReorderPlan = { lines: [], unavailable: [], changed: [] };
  for (const item of order.items) {
    if (!item.product_id) {
      plan.unavailable.push(item.name);
      continue;
    }
    let product: ProductFull;
    try {
      product = await getJson<ProductFull>(`/products/${item.product_id}`);
    } catch {
      plan.unavailable.push(item.name);
      continue;
    }
    const groups: OptionSet[] = [...(product.variants ?? []), ...(product.option_groups ?? [])];
    const choices: Record<string, string> = {};
    let changed = false;
    for (const picked of item.options?.choices ?? []) {
      const group = groups.find((g) => g.name === picked.group);
      const exists = group?.options?.choices?.some((c) => c.name === picked.choice);
      if (group && exists) choices[group.id] = picked.choice;
      else changed = true;
    }
    if (changed) plan.changed.push(item.name);
    plan.lines.push({ product, qty: item.qty, choices, note: item.options?.note ?? '' });
  }
  return plan;
}
