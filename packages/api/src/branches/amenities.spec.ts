import { BadRequestException } from '@nestjs/common';
import { amenities } from './amenities';

describe('branch amenities', () => {
  it('keeps known amenities once, in a fixed order', () => {
    expect(amenities(['parking', 'wifi', 'pool', 'wifi'])).toEqual(['wifi', 'parking']);
    expect(amenities(null)).toEqual([]);
    expect(amenities([])).toEqual([]);
  });

  it('rejects anything that is not a list', () => {
    expect(() => amenities('wifi')).toThrow(BadRequestException);
    expect(() => amenities({ wifi: true })).toThrow(BadRequestException);
  });
});
