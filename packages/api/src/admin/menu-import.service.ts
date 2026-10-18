import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import * as ExcelJS from 'exceljs';
import { Category } from '../entities/category.entity';
import { Product } from '../entities/product.entity';
import { Branch } from '../entities/branch.entity';

interface ImportRow {
  category: string;
  name: string;
  description: string;
  price_aed: string;
  dietary_tags: string;
  display_order: string;
  branch_codes: string;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  not_in_file: string[];
}

@Injectable()
export class MenuImportService {
  constructor(
    @InjectRepository(Category) private categories: Repository<Category>,
    @InjectRepository(Product) private products: Repository<Product>,
    @InjectRepository(Branch) private branches: Repository<Branch>,
  ) {}

  // Only these columns are read from an uploaded sheet; anything else (including "__proto__") is ignored.
  private static readonly COLUMNS = ['category', 'name', 'description', 'price_aed', 'dietary_tags', 'display_order', 'branch_codes'];

  private static pick(raw: Record<string, unknown>): ImportRow {
    const row: Record<string, unknown> = {};
    for (const c of MenuImportService.COLUMNS) if (Object.prototype.hasOwnProperty.call(raw, c)) row[c] = raw[c];
    return row as unknown as ImportRow;
  }

  private async parseFile(buffer: Buffer, filename: string): Promise<ImportRow[]> {
    const name = filename.toLowerCase();
    if (name.endsWith('.csv')) {
      try {
        const rows = parse(buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, bom: true }) as Record<string, unknown>[];
        return rows.map(MenuImportService.pick);
      } catch (e) {
        throw new BadRequestException(`Could not read that CSV file: ${(e as Error).message}`.slice(0, 200));
      }
    }
    if (name.endsWith('.xlsx')) {
      const book = new ExcelJS.Workbook();
      try {
        await book.xlsx.load(buffer as any);
      } catch {
        throw new BadRequestException('Could not read that Excel file');
      }
      const sheet = book.worksheets[0];
      if (!sheet) return [];
      const header: string[] = [];
      sheet.getRow(1).eachCell((cell, col) => (header[col] = String(cell.text ?? '').trim()));
      const rows: ImportRow[] = [];
      sheet.eachRow((r, n) => {
        if (n === 1) return;
        const raw: Record<string, unknown> = {};
        r.eachCell((cell, col) => {
          const key = header[col];
          if (key) raw[key] = typeof cell.value === 'number' ? cell.value : cell.text;
        });
        rows.push(MenuImportService.pick(raw));
      });
      return rows;
    }
    throw new BadRequestException('Unsupported file format. Use .csv or .xlsx');
  }

  private static async sheet(data: Record<string, unknown>[]): Promise<Buffer> {
    const book = new ExcelJS.Workbook();
    const ws = book.addWorksheet('Menu');
    ws.columns = MenuImportService.COLUMNS.map((key) => ({ header: key, key }));
    data.forEach((d) => ws.addRow(d));
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  private parsePrice(price: string | number): number | null {
    const n = Number(price);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  async import(buffer: Buffer, filename: string, dryRun = true): Promise<ImportResult> {
    const rows = await this.parseFile(buffer, filename);
    const result: ImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      not_in_file: [],
    };

    const allBranches = await this.branches.find();
    const branchCodeMap = new Map(allBranches.map((b) => [b.code, b]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        if (!row.category?.trim() || !row.name?.trim()) {
          result.errors.push({ row: rowNum, message: 'Category and name are required' });
          continue;
        }

        const price = this.parsePrice(row.price_aed);
        if (price === null) {
          result.errors.push({ row: rowNum, message: 'Price must be a valid number' });
          continue;
        }

        const categoryName = row.category.trim();
        let category = await this.categories.findOne({ where: { name: categoryName } });
        if (!category && !dryRun) {
          category = await this.categories.save(
            this.categories.create({
              name: categoryName,
              is_active: true,
            }),
          );
        }

        if (!category) {
          result.skipped++;
          continue;
        }

        const productName = row.name.trim();
        let product = await this.products.findOne({
          where: { name: productName, category_id: category.id },
        });

        const tags = row.dietary_tags
          ? row.dietary_tags
              .split(',')
              .map((t) => t.trim())
              .filter((t) => t)
          : [];

        if (!product && !dryRun) {
          product = await this.products.save(
            this.products.create({
              sku: `${categoryName.toLowerCase().replace(/\s+/g, '-')}-${productName.toLowerCase().replace(/\s+/g, '-')}`,
              name: productName,
              description: row.description?.trim() ?? '',
              category_id: category.id,
              base_price: price,
              dietary_tags: tags,
              display_order: row.display_order ? Number(row.display_order) : 0,
              status: 'active',
            }),
          );
          result.created++;
        } else if (product && !dryRun) {
          product.description = row.description?.trim() ?? product.description;
          product.base_price = price;
          product.dietary_tags = tags;
          if (row.display_order) product.display_order = Number(row.display_order);
          await this.products.save(product);
          result.updated++;
        } else if (product) {
          result.updated++;
        } else {
          result.created++;
        }
      } catch (err) {
        result.errors.push({ row: rowNum, message: String(err).slice(0, 100) });
      }
    }

    // Find products not in the file
    if (!dryRun) {
      const allProducts = await this.products.find();
      const importedNames = new Set(rows.map((r) => r.name?.trim()).filter(Boolean));
      result.not_in_file = allProducts
        .filter((p) => !importedNames.has(p.name))
        .map((p) => p.name);
    }

    return result;
  }

  async export(): Promise<Buffer> {
    const products = await this.products.find({ relations: ['category'] });
    const data = products.map((p) => ({
      category: p.category?.name ?? '',
      name: p.name,
      description: p.description,
      price_aed: p.base_price,
      dietary_tags: p.dietary_tags?.join(', ') ?? '',
      display_order: p.display_order,
      branch_codes: 'ALL',
    }));

    return MenuImportService.sheet(data);
  }

  async template(): Promise<Buffer> {
    const data = [
      {
        category: 'Espresso',
        name: 'Americano',
        description: 'Double espresso with hot water',
        price_aed: 12,
        dietary_tags: 'vegan',
        display_order: 1,
        branch_codes: 'ALL',
      },
    ];
    return MenuImportService.sheet(data);
  }
}
