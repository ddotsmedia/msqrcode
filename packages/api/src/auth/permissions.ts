// Admin panel sections a user can be given. Full admins ('admin' role) have everything, including Users.
export const PERMISSIONS = [
  'requests', // table requests
  'availability', // sold out / available
  'kitchen', // orders screen
  'loyalty', // rewards counter, cards, coupons
  'gifts', // gift cards at the counter
  'promotions', // offers
  'business', // business accounts and invoices
  'catering',
  'careers',
  'dashboard', // insights, analytics, feedback
  'products',
  'categories',
  'menu-import',
  'branches', // branch settings, Ramadan mode
  'qr', // QR codes
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// What branch managers created before custom access could do (kept for those accounts until edited).
export const MANAGER_PRESET: Permission[] = ['requests', 'availability', 'kitchen', 'loyalty', 'gifts'];

// Sections tied to one branch: users with any of these need a branch.
export const BRANCH_SECTIONS: Permission[] = ['requests', 'availability', 'kitchen', 'loyalty', 'gifts', 'promotions'];

// In these sections a few actions stay with full admins even when the section is given:
// loyalty settings/adjustments, push broadcasts, cancelling gift cards, offer statistics.
// In every other section the permission covers all of it.
const SPLIT_SECTIONS: Permission[] = ['requests', 'availability', 'kitchen', 'loyalty', 'gifts', 'promotions'];

export interface AccessUser {
  role: string;
  permissions?: string[] | null;
}

export function permissionsOf(u: AccessUser): Permission[] {
  if (u.role === 'admin') return [...PERMISSIONS];
  if (Array.isArray(u.permissions)) return PERMISSIONS.filter((p) => u.permissions!.includes(p));
  return u.role === 'branch_manager' ? [...MANAGER_PRESET] : [];
}

// Which section an admin API path belongs to (first match wins). Users management belongs to none: full admins only.
const AREAS: [RegExp, Permission][] = [
  [/^\/admin\/service-requests(\/|$)/, 'requests'],
  [/^\/branches\/[^/]+\/products(\/|$)/, 'availability'],
  [/^\/admin\/orders(\/|$)/, 'kitchen'],
  [/^\/admin\/(loyalty|coupons|push)(\/|$)/, 'loyalty'],
  [/^\/admin\/gift-cards(\/|$)/, 'gifts'],
  [/^\/admin\/(promotions|offers)(\/|$)/, 'promotions'],
  [/^\/admin\/corporate(\/|$)/, 'business'],
  [/^\/admin\/catering(\/|$)/, 'catering'],
  [/^\/admin\/careers(\/|$)/, 'careers'],
  [/^\/(analytics|admin\/feedback)(\/|$)/, 'dashboard'],
  [/^\/admin\/menu(\/|$)/, 'menu-import'],
  [/^\/(admin\/)?categories(\/|$)/, 'categories'],
  [/^\/(admin\/)?products(\/|$)/, 'products'],
  [/^\/admin\/qr-codes(\/|$)/, 'qr'],
  [/^\/(admin\/)?branches(\/|$)/, 'branches'],
  [/^\/admin\/season(\/|$)/, 'branches'],
];
export function areaOf(path: string): Permission | null {
  const p = path.split('?')[0].replace(/^\/api(?=\/)/, '');
  return AREAS.find(([re]) => re.test(p))?.[1] ?? null;
}

// Lists other sections need for their drop-downs (e.g. Products needs categories, Offers needs branches): readable by any staff user.
const SHARED_READS = /^\/(api\/)?admin\/(categories|branches)\/?(\?.*)?$/;

// May this user call a route that @Roles(...roles) protects, at this path?
export function mayAccess(u: AccessUser, roles: string[], path: string, method = 'GET'): boolean {
  if (u.role === 'admin') return true;
  if (method === 'GET' && SHARED_READS.test(path) && permissionsOf(u).length > 0) return true;
  // Older branch manager accounts keep exactly their old access.
  if (u.role === 'branch_manager' && !Array.isArray(u.permissions)) return roles.includes('branch_manager');
  const area = areaOf(path);
  if (!area || !permissionsOf(u).includes(area)) return false;
  // Admin-only actions inside split sections stay admin-only.
  return roles.includes('branch_manager') || !SPLIT_SECTIONS.includes(area);
}
