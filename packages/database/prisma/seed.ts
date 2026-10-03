import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@milestones.ae' },
    update: {},
    create: {
      email: 'admin@milestones.ae',
      passwordHash: adminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Hot Drinks' },
      update: {},
      create: { name: 'Hot Drinks', displayOrder: 1, iconUrl: '☕', isActive: true },
    }),
    prisma.category.upsert({
      where: { name: 'Cold Drinks' },
      update: {},
      create: { name: 'Cold Drinks', displayOrder: 2, iconUrl: '🧊', isActive: true },
    }),
    prisma.category.upsert({
      where: { name: 'Pastries' },
      update: {},
      create: { name: 'Pastries', displayOrder: 3, iconUrl: '🥐', isActive: true },
    }),
    prisma.category.upsert({
      where: { name: 'Sandwiches' },
      update: {},
      create: { name: 'Sandwiches', displayOrder: 4, iconUrl: '🥪', isActive: true },
    }),
  ]);
  console.log(`✅ ${categories.length} categories created`);

  // Create sample branch
  const branch = await prisma.branch.upsert({
    where: { code: 'DIFC' },
    update: {},
    create: {
      code: 'DIFC',
      name: 'Milestones DIFC',
      address: 'DIFC Gate Village, Building 3, Dubai, UAE',
      timezone: 'Asia/Dubai',
      operatingHours: {
        Monday: { open: '06:00', close: '22:00' },
        Tuesday: { open: '06:00', close: '22:00' },
        Wednesday: { open: '06:00', close: '22:00' },
        Thursday: { open: '06:00', close: '22:00' },
        Friday: { open: '07:00', close: '23:00' },
        Saturday: { open: '07:00', close: '23:00' },
        Sunday: { open: '07:00', close: '21:00' },
      },
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Branch: ${branch.name} (${branch.code})`);

  // Create sample products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'ESP-001' },
      update: {},
      create: {
        sku: 'ESP-001',
        name: 'Espresso',
        description: 'Rich, full-bodied single shot espresso',
        categoryId: categories[0].id,
        basePrice: 15.0,
        status: 'ACTIVE',
        isPopular: true,
        dietaryTags: ['vegan', 'gluten-free'],
        allergens: [],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'LAT-001' },
      update: {},
      create: {
        sku: 'LAT-001',
        name: 'Caffè Latte',
        description: 'Smooth espresso with steamed milk',
        categoryId: categories[0].id,
        basePrice: 22.0,
        status: 'ACTIVE',
        isPopular: true,
        dietaryTags: [],
        allergens: ['milk'],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'ICE-001' },
      update: {},
      create: {
        sku: 'ICE-001',
        name: 'Iced Americano',
        description: 'Double shot over ice with cold water',
        categoryId: categories[1].id,
        basePrice: 20.0,
        status: 'ACTIVE',
        isNew: true,
        dietaryTags: ['vegan', 'gluten-free'],
        allergens: [],
      },
    }),
    prisma.product.upsert({
      where: { sku: 'CRO-001' },
      update: {},
      create: {
        sku: 'CRO-001',
        name: 'Butter Croissant',
        description: 'Flaky, golden French croissant',
        categoryId: categories[2].id,
        basePrice: 12.0,
        status: 'ACTIVE',
        dietaryTags: [],
        allergens: ['gluten', 'milk', 'eggs'],
      },
    }),
  ]);
  console.log(`✅ ${products.length} products created`);

  // Create product availability for branch
  for (const product of products) {
    await prisma.productAvailability.upsert({
      where: {
        branchId_productId: { branchId: branch.id, productId: product.id },
      },
      update: {},
      create: {
        branchId: branch.id,
        productId: product.id,
        isAvailable: true,
      },
    });
  }
  console.log(`✅ Product availability set for ${branch.code}`);

  // Create branch manager
  const managerPassword = await bcrypt.hash('manager123!', 10);
  await prisma.user.upsert({
    where: { email: 'difc.manager@milestones.ae' },
    update: {},
    create: {
      email: 'difc.manager@milestones.ae',
      passwordHash: managerPassword,
      firstName: 'DIFC',
      lastName: 'Manager',
      role: 'BRANCH_MANAGER',
      assignedBranchId: branch.id,
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Branch manager created`);

  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
