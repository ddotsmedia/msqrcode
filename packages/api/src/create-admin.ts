import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AppModule } from './app.module';
import { User } from './entities';

// One-time admin create/reset. Reads NEW_ADMIN_EMAIL and NEW_ADMIN_PASSWORD from env.
async function run(): Promise<void> {
  const email = (process.env.NEW_ADMIN_EMAIL ?? '').trim();
  const password = process.env.NEW_ADMIN_PASSWORD ?? '';
  if (!email || password.length < 12) {
    throw new Error('NEW_ADMIN_EMAIL is required and NEW_ADMIN_PASSWORD must be at least 12 characters');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const repo = app.get<Repository<User>>(getRepositoryToken(User));
    const password_hash = await bcrypt.hash(password, 12);
    const existing = await repo.findOne({ where: { email } });
    if (existing) {
      existing.password_hash = password_hash;
      existing.role = 'admin';
      existing.status = 'active';
      await repo.save(existing);
      console.log(`Updated admin: ${email}`);
    } else {
      await repo.save(repo.create({ email, password_hash, role: 'admin', status: 'active' }));
      console.log(`Created admin: ${email}`);
    }
  } finally {
    await app.close();
  }
}

run().catch((e: Error) => {
  console.error(`create-admin failed: ${e.message}`);
  process.exit(1);
});
