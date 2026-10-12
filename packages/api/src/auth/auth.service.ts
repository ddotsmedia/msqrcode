import { Injectable, OnApplicationBootstrap, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';

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

  async login(email: string, password: string): Promise<{ access_token: string }> {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const access_token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { access_token };
  }
}
