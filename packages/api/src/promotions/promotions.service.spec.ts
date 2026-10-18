import { BadRequestException } from '@nestjs/common';
import { PromotionsService } from './promotions.service';

function setup() {
  const promos = { create: jest.fn((x: any) => x), save: jest.fn(async (x: any) => x) };
  return new PromotionsService(promos as any);
}

describe('PromotionsService offer visuals', () => {
  it('saves an https image, an upper-case code and the featured flag', async () => {
    const row = await setup().create({ title: 'Two for one', image_url: ' https://cdn.example.com/a.jpg ', promo_code: ' bogo-24 ', featured: true });
    expect(row).toMatchObject({ image_url: 'https://cdn.example.com/a.jpg', promo_code: 'BOGO-24', featured: true });
  });

  it('defaults to no image, no code, not featured and no theme', async () => {
    expect(await setup().create({ title: 'Plain' })).toMatchObject({ image_url: null, promo_code: null, featured: false, theme: null });
  });

  it('saves a combo of 2 to 4 items with a price', async () => {
    const A = '11111111-1111-1111-1111-111111111111';
    const B = '22222222-2222-2222-2222-222222222222';
    expect(await setup().create({ title: 'Combo', combo_product_ids: [A, B, A], combo_price: '22.5' })).toMatchObject({ combo_product_ids: [A, B], combo_price: 22.5 });
    await expect(setup().create({ title: 'x', combo_product_ids: [A], combo_price: 10 })).rejects.toThrow('2 to 4');
    await expect(setup().create({ title: 'x', combo_product_ids: [A, B], combo_price: 0 })).rejects.toThrow('Combo price');
  });

  it('keeps known occasion themes only', async () => {
    expect((await setup().create({ title: 'x', theme: 'national_day' })).theme).toBe('national_day');
    expect((await setup().create({ title: 'x', theme: 'halloween' })).theme).toBeNull();
  });

  it('rejects unsafe images and bad codes', async () => {
    await expect(setup().create({ title: 'x', image_url: 'http://a.com/a.jpg' })).rejects.toThrow('https');
    await expect(setup().create({ title: 'x', image_url: 'javascript:alert(1)' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup().create({ title: 'x', image_url: 'https://a.com/"onerror="x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup().create({ title: 'x', promo_code: 'A B' })).rejects.toThrow('Code');
    await expect(setup().create({ title: 'x', promo_code: 'AB' })).rejects.toThrow('Code');
  });
});
