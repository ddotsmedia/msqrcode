// Branch amenities (same keys as the API's branches/amenities.ts).
export const AMENITIES: Record<string, { label: string; icon: string }> = {
  wifi: { label: 'Wi-Fi', icon: '📶' },
  parking: { label: 'Parking', icon: '🅿️' },
  drive_thru: { label: 'Drive-thru', icon: '🚗' },
  outdoor: { label: 'Outdoor seating', icon: '🌴' },
  family: { label: 'Family area', icon: '👨‍👩‍👧' },
  laptop: { label: 'Laptop friendly', icon: '💻' },
  wheelchair: { label: 'Wheelchair access', icon: '♿' },
  kids: { label: 'Kids area', icon: '🧸' },
};

export const amenityList = (a?: string[] | null) => (Array.isArray(a) ? a.filter((k) => AMENITIES[k]) : []);
