import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { mayAccess } from './permissions';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // A guarded route with no @Roles is a mistake: refuse rather than let every signed-in user in.
    if (!roles || roles.length === 0) throw new ForbiddenException('Insufficient role');
    const req = context.switchToHttp().getRequest();
    // Full admins pass; everyone else needs the section this path belongs to (see permissions.ts).
    if (!req.user || !mayAccess(req.user, roles, req.originalUrl ?? req.url ?? '', req.method)) {
      throw new ForbiddenException('You do not have access to this section');
    }
    return true;
  }
}
