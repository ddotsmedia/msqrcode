const KEY = 'msq_favs';

// Product ids the visitor has hearted. Stored only on this device.
export function readFavs(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function toggleFav(id: string): string[] {
  const cur = readFavs();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: favourites last for this visit only */
  }
  return next;
}
