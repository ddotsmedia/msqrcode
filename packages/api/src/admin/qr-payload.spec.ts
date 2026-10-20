import { qrPayload } from './qr-codes.service';

const BRANCH = '11111111-1111-4111-8111-111111111111';
const PROMO = '22222222-2222-4222-8222-222222222222';

describe('qrPayload', () => {
  it('keeps branch and table links', () => {
    expect(qrPayload(BRANCH, 'branch', null)).toMatch(/\/\?branch=/);
    expect(qrPayload(BRANCH, 'table', '7')).toMatch(/&table=7$/);
  });
  it('feedback code opens the feedback form for the branch', () => {
    expect(qrPayload(BRANCH, 'feedback', null)).toMatch(/\?branch=1111.*&feedback=1$/);
  });
  it('promo code opens the offers page for the offer', () => {
    expect(qrPayload(BRANCH, 'promo', null, PROMO)).toMatch(/\/offers\?promo=2222/);
  });
});
