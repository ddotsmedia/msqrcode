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
