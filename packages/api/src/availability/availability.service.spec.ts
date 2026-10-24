import { AvailabilityService } from './availability.service';

const BRANCH = '11111111-1111-1111-1111-111111111111';
const PRODUCT = '22222222-2222-2222-2222-222222222222';

function repo(existing: { is_available: boolean } | null) {
  return {
    findOne: jest.fn(async () => existing),
    create: jest.fn((x: object) => x),
    save: jest.fn(async (x: object) => x),
  };
}

describe('AvailabilityService change log', () => {
  it('logs when a product is marked sold out', async () => {
    const avail = repo({ is_available: true });
    const log = repo(null);
    const svc = new AvailabilityService(avail as any, log as any);
    await svc.updateAvailability(BRANCH, PRODUCT, false, 'u1');
    expect(log.save).toHaveBeenCalledWith(
      expect.objectContaining({ branch_id: BRANCH, product_id: PRODUCT, is_available: false, changed_by_user_id: 'u1' }),
    );
  });

  it('does not log when the state is unchanged', async () => {
    const avail = repo({ is_available: false });
    const log = repo(null);
    const svc = new AvailabilityService(avail as any, log as any);
    await svc.updateAvailability(BRANCH, PRODUCT, false);
    expect(log.save).not.toHaveBeenCalled();
  });
});
