import { useEffect, useState } from 'react';
import axios from 'axios';
import { setPageTitle } from './lib/seo';

interface Offer {
  id: string;
  title: string;
  body: string | null;
  starts_on: string | null;
  ends_on: string | null;
  branch_id: string | null;
}

// Current offers from the admin dashboard (all branches or one branch).
export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState(false);
  setPageTitle('Offers');

  useEffect(() => {
    axios
      .get<Offer[]>('/api/promotions')
      .then((r) => setOffers(r.data))
      .catch(() => setError(true));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Offers</h1>
      {error && <p className="text-red-600">Could not load offers. Please try again.</p>}
      {!error && offers === null && <p className="text-gray-500">Loading…</p>}
      {offers && offers.length === 0 && <p className="text-gray-600">No offers right now. Check back soon.</p>}
      {offers?.map((o) => (
        <article key={o.id} className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-lg">{o.title}</h2>
          {o.body && <p className="text-gray-700 mt-1 whitespace-pre-line">{o.body}</p>}
          {(o.starts_on || o.ends_on) && (
            <p className="text-xs text-gray-500 mt-2">
              {o.starts_on ? `From ${o.starts_on}` : ''} {o.ends_on ? `until ${o.ends_on}` : ''}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
