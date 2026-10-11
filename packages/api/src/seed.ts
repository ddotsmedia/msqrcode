import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Branch,
  Category,
  Product,
  ProductVariant,
  OptionGroup,
  ProductAvailability,
} from './entities';

async function seed() {
  const app = await NestFactory.create(AppModule);

  const branchRepo = app.get<Repository<Branch>>(getRepositoryToken(Branch));
  const categoryRepo = app.get<Repository<Category>>(getRepositoryToken(Category));
  const productRepo = app.get<Repository<Product>>(getRepositoryToken(Product));
  const availabilityRepo = app.get<Repository<ProductAvailability>>(
    getRepositoryToken(ProductAvailability),
  );

  try {
    // Create branch
    let branch = await branchRepo.findOne({
      where: { code: 'DIFC' },
    });

    if (!branch) {
      branch = await branchRepo.save({
        code: 'DIFC',
        name: 'Milestones DIFC',
        description: 'Premium coffee experience in Dubai International Financial Centre',
        address: 'Dubai International Financial Centre, Dubai, UAE',
        phone: '+971-4-XXX-XXXX',
        timezone: 'Asia/Dubai',
        latitude: 25.2124,
        longitude: 55.271,
        logo_image_url:
          'https://via.placeholder.com/200x100.png?text=Milestones+Coffee',
        cover_image_url:
          'https://via.placeholder.com/800x400.png?text=Milestones+DIFC',
        operating_hours: {
          Monday: { open: '06:30', close: '20:00' },
          Tuesday: { open: '06:30', close: '20:00' },
          Wednesday: { open: '06:30', close: '20:00' },
          Thursday: { open: '06:30', close: '20:00' },
          Friday: { open: '07:00', close: '21:00' },
          Saturday: { open: '07:00', close: '21:00' },
          Sunday: { open: '08:00', close: '19:00' },
        },
        status: 'active',
      });
      console.log('✓ Branch created:', branch.name);
    }

    // Create categories
    const categories: Record<string, Category> = {};
    const categoryData = [
      { name: 'Espresso', display_order: 1 },
      { name: 'Coffee', display_order: 2 },
      { name: 'Tea', display_order: 3 },
      { name: 'Cold Beverages', display_order: 4 },
      { name: 'Pastries & Food', display_order: 5 },
    ];

    for (const catData of categoryData) {
      let category = await categoryRepo.findOne({
        where: { name: catData.name },
      });

      if (!category) {
        category = await categoryRepo.save(catData);
        console.log('✓ Category created:', category.name);
      }
      categories[catData.name] = category;
    }

    // Create products
    const products: Record<string, Product> = {};
    const productData = [
      {
        name: 'Espresso',
        category: 'Espresso',
        sku: 'ESP-001',
        description: 'Single shot of premium espresso',
        base_price: 12,
        is_popular: true,
        dietary_tags: [],
        allergens: [],
      },
      {
        name: 'Double Espresso',
        category: 'Espresso',
        sku: 'ESP-002',
        description: 'Double shot of rich espresso',
        base_price: 15,
        dietary_tags: [],
        allergens: [],
      },
      {
        name: 'Cappuccino',
        category: 'Coffee',
        sku: 'CAP-001',
        description: 'Creamy cappuccino with perfectly steamed milk',
        base_price: 18,
        is_popular: true,
        dietary_tags: [],
        allergens: ['Dairy'],
      },
      {
        name: 'Latte',
        category: 'Coffee',
        sku: 'LAT-001',
        description: 'Smooth latte with velvety milk foam',
        base_price: 18,
        dietary_tags: [],
        allergens: ['Dairy'],
      },
      {
        name: 'Flat White',
        category: 'Coffee',
        sku: 'FLW-001',
        description: 'Velvety espresso with microfoam milk',
        base_price: 20,
        is_popular: true,
        dietary_tags: [],
        allergens: ['Dairy'],
      },
      {
        name: 'Americano',
        category: 'Coffee',
        sku: 'AME-001',
        description: 'Strong espresso topped with hot water',
        base_price: 15,
        dietary_tags: ['Vegan'],
        allergens: [],
      },
      {
        name: 'Macchiato',
        category: 'Coffee',
        sku: 'MAC-001',
        description: 'Espresso marked with a dollop of foam',
        base_price: 16,
        dietary_tags: [],
        allergens: ['Dairy'],
      },
      {
        name: 'Mocha',
        category: 'Coffee',
        sku: 'MOC-001',
        description: 'Rich espresso with chocolate and steamed milk',
        base_price: 22,
        is_new: true,
        dietary_tags: [],
        allergens: ['Dairy', 'Nuts'],
      },
      {
        name: 'Green Tea',
        category: 'Tea',
        sku: 'TEA-001',
        description: 'Refreshing organic green tea',
        base_price: 14,
        dietary_tags: ['Vegan', 'Gluten-Free'],
        allergens: [],
      },
      {
        name: 'Iced Coffee',
        category: 'Cold Beverages',
        sku: 'ICE-001',
        description: 'Chilled espresso with ice and milk',
        base_price: 18,
        dietary_tags: [],
        allergens: ['Dairy'],
      },
      {
        name: 'Iced Latte',
        category: 'Cold Beverages',
        sku: 'ICE-002',
        description: 'Cold smooth latte served over ice',
        base_price: 20,
        dietary_tags: [],
        allergens: ['Dairy'],
      },
      {
        name: 'Croissant',
        category: 'Pastries & Food',
        sku: 'PAS-001',
        description: 'Buttery French croissant',
        base_price: 16,
        dietary_tags: [],
        allergens: ['Gluten', 'Dairy'],
      },
      {
        name: 'Chocolate Croissant',
        category: 'Pastries & Food',
        sku: 'PAS-002',
        description: 'Croissant filled with rich dark chocolate',
        base_price: 18,
        dietary_tags: [],
        allergens: ['Gluten', 'Dairy', 'Nuts'],
      },
      {
        name: 'Blueberry Muffin',
        category: 'Pastries & Food',
        sku: 'PAS-003',
        description: 'Fresh blueberry muffin',
        base_price: 14,
        dietary_tags: [],
        allergens: ['Gluten', 'Dairy'],
      },
      {
        name: 'Almond Biscotti',
        category: 'Pastries & Food',
        sku: 'PAS-004',
        description: 'Crunchy almond biscotti, perfect for dipping',
        base_price: 12,
        dietary_tags: [],
        allergens: ['Gluten', 'Nuts'],
      },
    ];

    for (const prodData of productData) {
      let product = await productRepo.findOne({
        where: { sku: prodData.sku },
      });

      if (!product) {
        const category = categories[prodData.category];
        product = await productRepo.save({
          ...prodData,
          category_id: category.id,
          display_order: productData.indexOf(prodData) + 1,
          image_url: `https://via.placeholder.com/300x300.png?text=${prodData.name}`,
          status: 'active',
        });
        console.log('✓ Product created:', product.name);

        // Create availability record for this branch
        await availabilityRepo.save({
          branch_id: branch.id,
          product_id: product.id,
          is_available: true,
        });
      }
      products[prodData.sku] = product;
    }

    console.log('✓ Database seeding completed successfully!');
    console.log(`  - 1 Branch (${branch.name})`);
    console.log(`  - ${Object.keys(categories).length} Categories`);
    console.log(`  - ${Object.keys(products).length} Products`);
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await app.close();
  }
}

seed();
