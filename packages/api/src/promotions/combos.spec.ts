import { comboSavings } from './combos';

const combo = { title: 'Coffee + croissant', combo_product_ids: ['latte', 'croissant'], combo_price: 22 };

describe('comboSavings', () => {
  it('applies a combo once per full set', () => {
    expect(comboSavings([{ product_id: 'latte', unit: 18, qty: 1 }, { product_id: 'croissant', unit: 12, qty: 1 }], [combo])).toEqual({
      amount: 8,
      applied: [{ title: 'Coffee + croissant', sets: 1, amount: 8 }],
    });
    const two = comboSavings([{ product_id: 'latte', unit: 18, qty: 3 }, { product_id: 'croissant', unit: 12, qty: 2 }], [combo]);
    expect(two).toMatchObject({ amount: 16, applied: [{ sets: 2 }] });
  });

  it('does nothing without a full set or when the combo would cost more', () => {
    expect(comboSavings([{ product_id: 'latte', unit: 18, qty: 2 }], [combo]).amount).toBe(0);
    expect(comboSavings([{ product_id: 'latte', unit: 10, qty: 1 }, { product_id: 'croissant', unit: 10, qty: 1 }], [combo]).amount).toBe(0);
  });

  it('uses the cheapest units and picks the best combo first', () => {
    const big = { title: 'Breakfast', combo_product_ids: ['latte', 'croissant', 'juice'], combo_price: 30 };
    const res = comboSavings(
      [
        { product_id: 'latte', unit: 18, qty: 1 },
        { product_id: 'latte', unit: 23.5, qty: 1 },
        { product_id: 'croissant', unit: 12, qty: 1 },
        { product_id: 'juice', unit: 15, qty: 1 },
      ],
      [combo, big],
    );
    expect(res.applied).toEqual([{ title: 'Breakfast', sets: 1, amount: 15 }]);
  });

  it('ignores broken combos', () => {
    expect(comboSavings([{ product_id: 'latte', unit: 18, qty: 1 }], [{ title: 'x', combo_product_ids: ['latte'], combo_price: 1 }, { title: 'y', combo_product_ids: null, combo_price: null }]).amount).toBe(0);
  });
});
