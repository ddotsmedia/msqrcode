import { areaOf, mayAccess, permissionsOf } from './permissions';

const staff = (permissions: string[]) => ({ role: 'staff', permissions });

describe('admin panel permissions', () => {
  it('full admins can do everything, including users', () => {
    expect(mayAccess({ role: 'admin' }, ['admin'], '/admin/users')).toBe(true);
    expect(permissionsOf({ role: 'admin' })).toContain('products');
  });

  it('older branch manager accounts keep exactly their old access', () => {
    const m = { role: 'branch_manager', permissions: null };
    expect(mayAccess(m, ['admin', 'branch_manager'], '/admin/orders')).toBe(true);
    expect(mayAccess(m, ['admin'], '/admin/catering')).toBe(false);
    expect(permissionsOf(m)).toEqual(['requests', 'availability', 'kitchen', 'loyalty', 'gifts']);
  });

  it('custom users get only the sections they were given', () => {
    const u = staff(['kitchen', 'products']);
    expect(mayAccess(u, ['admin', 'branch_manager'], '/admin/orders?branch_id=x')).toBe(true);
    expect(mayAccess(u, ['admin'], '/products/123')).toBe(true);
    expect(mayAccess(u, ['admin'], '/admin/products/1/variants')).toBe(true);
    expect(mayAccess(u, ['admin', 'branch_manager'], '/admin/gift-cards')).toBe(false);
    expect(mayAccess(u, ['admin'], '/admin/catering')).toBe(false);
  });

  it('keeps admin-only actions inside shared sections for full admins', () => {
    const u = staff(['loyalty', 'gifts']);
    expect(mayAccess(u, ['admin', 'branch_manager'], '/admin/loyalty/stamp')).toBe(true);
    expect(mayAccess(u, ['admin'], '/admin/loyalty/settings')).toBe(false);
    expect(mayAccess(u, ['admin'], '/admin/push/broadcast')).toBe(false);
    expect(mayAccess(u, ['admin'], '/admin/gift-cards/ABCD2345/cancel')).toBe(false);
  });

  it('never lets anyone but full admins manage users', () => {
    const all = staff(['requests', 'availability', 'kitchen', 'loyalty', 'gifts', 'promotions', 'business', 'catering', 'careers', 'dashboard', 'products', 'categories', 'menu-import', 'branches', 'qr']);
    expect(mayAccess(all, ['admin'], '/admin/users')).toBe(false);
    expect(areaOf('/admin/users/1')).toBeNull();
  });

  it('lets any staff user read the category and branch lists other pages need, but not change them', () => {
    const u = staff(['products']);
    expect(mayAccess(u, ['admin'], '/admin/categories', 'GET')).toBe(true);
    expect(mayAccess(u, ['admin'], '/admin/branches', 'GET')).toBe(true);
    expect(mayAccess(u, ['admin'], '/admin/categories', 'POST')).toBe(false);
    expect(mayAccess(u, ['admin'], '/admin/branches/b1', 'PUT')).toBe(false);
    expect(mayAccess(staff([]), ['admin'], '/admin/categories', 'GET')).toBe(false);
  });

  it('maps availability before branch settings', () => {
    expect(areaOf('/branches/b1/products/p1/availability')).toBe('availability');
    expect(areaOf('/branches/b1')).toBe('branches');
    expect(areaOf('/api/admin/season')).toBe('branches');
  });
});
