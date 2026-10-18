import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectRepository(User) private users: Repository<User>) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // Role, branch and status come from the database on every request, so a suspended,
  // demoted or moved user loses access at once instead of when the token expires.
  async validate(payload: { sub: string }) {
    const user = payload?.sub ? await this.users.findOne({ where: { id: payload.sub } }) : null;
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      assigned_branch_id: user.assigned_branch_id ?? null,
      permissions: user.permissions ?? null,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || null,
    };
  }
}
