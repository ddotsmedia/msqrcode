import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import type { SiteBranch } from './Site';

// Map of all branches with coordinates. Uses OpenStreetMap tiles (no API key).
export default function BranchMapPage({ branches }: { branches: SiteBranch[] | null }) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!elRef.current || !branches) return;
    const withCoords = branches.filter((b) => typeof b.latitude === 'number' && typeof b.longitude === 'number');
    const map = L.map(elRef.current).setView([24.45, 54.4], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    const bounds = L.latLngBounds([]);
    withCoords.forEach((b) => {
      const ll: L.LatLngExpression = [b.latitude as number, b.longitude as number];
      bounds.extend(ll);
      L.marker(ll)
        .addTo(map)
        .bindPopup(`<strong>${b.name}</strong><br/>${b.address}<br/><a href="/branches/${b.id}">Details</a>`);
    });
    if (withCoords.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    return () => {
      map.remove();
    };
  }, [branches]);

  const missing = (branches ?? []).filter((b) => typeof b.latitude !== 'number' || typeof b.longitude !== 'number');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Branch map</h1>
      <div ref={elRef} className="w-full h-[60vh] min-h-[320px] rounded-xl overflow-hidden shadow-sm" />
      {branches && missing.length > 0 && (
        <p className="text-sm text-gray-600">
          Not on the map yet:{' '}
          {missing.map((b, i) => (
            <span key={b.id}>
              {i > 0 && ', '}
              <Link to={`/branches/${b.id}`} className="underline">{b.name}</Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
