import { useEffect, useState } from 'react';
import axios from 'axios';

export interface Ramadan {
  greeting: string;
  note: string | null;
  ends_on: string | null;
  featured_category_ids: string[];
}

// Ramadan mode from the admin (null when off). Fetched once per page load.
let pending: Promise<Ramadan | null> | null = null;
export function useRamadan() {
  const [r, setR] = useState<Ramadan | null>(null);
  useEffect(() => {
    pending ??= axios
      .get('/api/season')
      .then((res) => (res.data?.ramadan as Ramadan) ?? null)
      .catch(() => null);
    let alive = true;
    pending.then((v) => alive && setR(v));
    return () => {
      alive = false;
    };
  }, []);
  return r;
}

export function Crescent({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M14.5 2.5a9.5 9.5 0 1 0 7 15.9A8 8 0 0 1 14.5 2.5Z" />
      <path d="m19 4 .6 1.4L21 6l-1.4.6L19 8l-.6-1.4L17 6l1.4-.6Z" />
    </svg>
  );
}
