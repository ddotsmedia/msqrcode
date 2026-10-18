import { BadRequestException } from '@nestjs/common';

// What a branch offers, shown and filterable on the website's Branches page.
export const AMENITIES = ['wifi', 'parking', 'drive_thru', 'outdoor', 'family', 'laptop', 'wheelchair', 'kids'] as const;

// Keeps known amenities only, in a fixed order; null clears them.
export function amenities(v: unknown): string[] {
  if (v === null) return [];
  if (!Array.isArray(v)) throw new BadRequestException('Amenities must be a list');
  return AMENITIES.filter((a) => v.includes(a));
}
