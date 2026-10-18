import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { OptionGroup } from '../entities/option-group.entity';

const PRODUCT_STATUSES = ['active', 'inactive', 'archived'];

type Dict = Record<string, unknown>;

function str(v: unknown, field: string, required = false, max = 255): string | undefined {
  if (v === undefined || v === null || v === '') {
    if (required) throw new BadRequestException(`${field} is required`);
    return undefined;
  }
  if (typeof v !== 'string' || v.trim().length > max) {
    throw new BadRequestException(`${field} must be text up to ${max} characters`);
  }
  return v.trim();
}

function num(v: unknown, field: string, min = 0): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new BadRequestException(`${field} must be a number ≥ ${min}`);
  return n;
}

function bool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  return v === true || v === 'true';
}

function list(v: unknown): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    throw new BadRequestException('Expected a list of text values');
  }
  return v.map((x) => x.trim()).filter(Boolean);
}

// Nutrition shown on the menu: calories (kcal), caffeine (mg), sugar and protein (g). Empty = not shown.
const NUTRIENTS = ['calories', 'caffeine_mg', 'sugar_g', 'protein_g'] as const;
function nutrition(v: unknown): Record<string, number> | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || typeof v !== 'object') return null;
  const out: Record<string, number> = {};
  for (const k of NUTRIENTS) {
    const n = num((v as Record<string, unknown>)[k], k);
    if (n !== undefined) {
      if (n > 5000) throw new BadRequestException(`${k} looks too high`);
      out[k] = Math.round(n);
    }
  }
  return Object.keys(out).length ? out : null;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Product) private products: Repository<Product>,
    @InjectRepository(Category) private categories: Repository<Category>,
    @InjectRepository(ProductVariant) private variants: Repository<ProductVariant>,
    @InjectRepository(OptionGroup) private optionGroups: Repository<OptionGroup>,
  ) {}

  // ---- categories
  listCategories() {
    return this.categories.find({ order: { display_order: 'ASC' } });
  }

  async saveCategory(id: string | null, body: Dict) {
    const data: Partial<Category> = {
      name: str(body.name, 'name', true, 100),
      description: str(body.description, 'description', false, 1000),
      display_order: num(body.display_order, 'display_order'),
      is_active: bool(body.is_active),
    };
    if (id) {
      const existing = await this.categories.findOne({ where: { id } });
      if (!existing) throw new NotFoundException('Category not found');
      Object.assign(existing, stripUndefined(data));
      return this.categories.save(existing);
    }
    return this.categories.save(this.categories.create(stripUndefined(data)));
  }

  async archiveCategory(id: string) {
    const c = await this.categories.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Category not found');
    c.is_active = false;
    return this.categories.save(c);
  }

  // ---- products
  listProducts() {
    return this.products.find({
      relations: ['category', 'variants', 'option_groups'],
      order: { display_order: 'ASC', name: 'ASC' },
    });
  }

  async saveProduct(id: string | null, body: Dict) {
    const status = body.status === undefined ? undefined : str(body.status, 'status', true, 20);
    if (status !== undefined && !PRODUCT_STATUSES.includes(status)) {
      throw new BadRequestException(`status must be one of ${PRODUCT_STATUSES.join(', ')}`);
    }
    const data: Partial<Product> = {
      name: str(body.name, 'name', true),
      sku: str(body.sku, 'sku', true, 100),
      description: str(body.description, 'description', false, 2000),
      category_id: str(body.category_id, 'category_id', !id, 36),
      base_price: num(body.base_price, 'base_price'),
      image_url: str(body.image_url, 'image_url', false, 1000),
      status,
      display_order: num(body.display_order, 'display_order'),
      is_new: bool(body.is_new),
      is_popular: bool(body.is_popular),
      is_seasonal: bool(body.is_seasonal),
      dietary_tags: list(body.dietary_tags),
      allergens: list(body.allergens),
      nutritional_info: nutrition(body.nutritional_info) as Product['nutritional_info'],
    };
    if (!id && data.base_price === undefined) {
      throw new BadRequestException('base_price is required');
    }
    if (id) {
      const existing = await this.products.findOne({ where: { id } });
      if (!existing) throw new NotFoundException('Product not found');
      Object.assign(existing, stripUndefined(data));
      await this.products.save(existing);
      return this.products.findOne({ where: { id }, relations: ['category', 'variants', 'option_groups'] });
    }
    const saved = await this.products.save(this.products.create(stripUndefined(data)));
    return this.products.findOne({ where: { id: saved.id }, relations: ['category', 'variants', 'option_groups'] });
  }

  async archiveProduct(id: string) {
    const p = await this.products.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    p.status = 'archived';
    return this.products.save(p);
  }

  // ---- variants and option groups (stored as name + price adjustments)
  private async productOrFail(productId: string) {
    const p = await this.products.findOne({ where: { id: productId } });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  private parseOptions(raw: unknown): { name: string; price_adjustment: number }[] {
    if (!Array.isArray(raw)) throw new BadRequestException('options must be a list');
    return raw.map((o) => {
      const item = o as Dict;
      return {
        name: str(item.name, 'option name', true, 100) as string,
        price_adjustment: num(item.price_adjustment ?? 0, 'price_adjustment', -100000) as number,
      };
    });
  }

  async addVariant(productId: string, body: Dict) {
    await this.productOrFail(productId);
    return this.variants.save(
      this.variants.create({
        product_id: productId,
        name: str(body.name, 'name', true, 100) as string,
        display_order: num(body.display_order, 'display_order') ?? 0,
        options: { choices: this.parseOptions(body.options) },
      }),
    );
  }

  async updateVariant(productId: string, variantId: string, body: Dict) {
    const v = await this.variants.findOne({ where: { id: variantId, product_id: productId } });
    if (!v) throw new NotFoundException('Variant not found');
    if (body.name !== undefined) v.name = str(body.name, 'name', true, 100) as string;
    if (body.display_order !== undefined) v.display_order = num(body.display_order, 'display_order') ?? 0;
    if (body.options !== undefined) v.options = { choices: this.parseOptions(body.options) };
    return this.variants.save(v);
  }

  async removeVariant(productId: string, variantId: string) {
    const res = await this.variants.delete({ id: variantId, product_id: productId });
    if (!res.affected) throw new NotFoundException('Variant not found');
  }

  async addOptionGroup(productId: string, body: Dict) {
    await this.productOrFail(productId);
    return this.optionGroups.save(
      this.optionGroups.create({
        product_id: productId,
        name: str(body.name, 'name', true, 100) as string,
        display_order: num(body.display_order, 'display_order') ?? 0,
        options: { choices: this.parseOptions(body.options) },
      }),
    );
  }

  async updateOptionGroup(productId: string, groupId: string, body: Dict) {
    const g = await this.optionGroups.findOne({ where: { id: groupId, product_id: productId } });
    if (!g) throw new NotFoundException('Option group not found');
    if (body.name !== undefined) g.name = str(body.name, 'name', true, 100) as string;
    if (body.display_order !== undefined) g.display_order = num(body.display_order, 'display_order') ?? 0;
    if (body.options !== undefined) g.options = { choices: this.parseOptions(body.options) };
    return this.optionGroups.save(g);
  }

  async removeOptionGroup(productId: string, groupId: string) {
    const res = await this.optionGroups.delete({ id: groupId, product_id: productId });
    if (!res.affected) throw new NotFoundException('Option group not found');
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
