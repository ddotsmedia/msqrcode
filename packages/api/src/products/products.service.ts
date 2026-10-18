import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<Product[]> {
    return this.productsRepository.find({
      where: { status: 'active' },
      relations: ['category', 'variants', 'option_groups'],
      order: { display_order: 'ASC' },
    });
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['category', 'variants', 'option_groups'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async findByCategory(categoryId: string): Promise<Product[]> {
    return this.productsRepository.find({
      where: { category_id: categoryId, status: 'active' },
      relations: ['variants', 'option_groups'],
      order: { display_order: 'ASC' },
    });
  }

  async search(query: string): Promise<Product[]> {
    return this.productsRepository
      .createQueryBuilder('product')
      // Escape LIKE wildcards so a search for "%" does not match everything; cap the length and results.
      .where("(product.name ILIKE :query ESCAPE '\\' OR product.description ILIKE :query ESCAPE '\\')", {
        query: `%${String(query ?? '').slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`)}%`,
      })
      .andWhere('product.status = :status', { status: 'active' })
      .orderBy('product.display_order', 'ASC')
      .addOrderBy('product.name', 'ASC')
      .take(50)
      .getMany();
  }

  async create(productData: Partial<Product>): Promise<Product> {
    const product = this.productsRepository.create(productData);
    return this.productsRepository.save(product);
  }

  async update(id: string, productData: Partial<Product>): Promise<Product> {
    await this.productsRepository.update(id, productData);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.productsRepository.delete(id);
  }
}
