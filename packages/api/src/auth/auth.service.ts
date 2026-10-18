import { Injectable, OnApplicationBootstrap, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';

const DUMMY_HASH = '$2a$12$.XQHpT.MXAjCbJtX9zzfJOhrMapr4XIRgUu30NHzjZbi4BwqT7jBC';

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  // Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when no users exist.
  async onApplicationBootstrap(): Promise<void> {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;
    if (password.length < 12) {
      this.logger.warn('ADMIN_PASSWORD must be at least 12 characters; first admin not created');
      return;
    }
    const count = await this.usersRepo.count();
    if (count > 0) return;
    await this.usersRepo.save(
      this.usersRepo.create({
        email,
        password_hash: await bcrypt.hash(password, 12),
        role: 'admin',
        status: 'active',
      }),
    );
    this.logger.log(`Created initial admin ${email}`);
  }

  async login(emailRaw: unknown, passwordRaw: unknown): Promise<{ access_token: string }> {
    const email = typeof emailRaw === 'string' ? emailRaw.trim().slice(0, 200) : '';
    const password = typeof passwordRaw === 'string' ? passwordRaw.slice(0, 200) : '';
    if (!email || !password) throw new UnauthorizedException('Invalid credentials');
    const user = await this.usersRepo.findOne({ where: { email } });
    // Always run bcrypt, so the response time does not reveal whether the email exists.
    const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || user.status !== 'active' || !ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const access_token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      assigned_branch_id: user.assigned_branch_id ?? null,
    });
    return { access_token };
  }
}
