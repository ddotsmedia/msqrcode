import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import type { SiteBranch } from './Site';

// Copper dot with a navy ring. Avoids Leaflet's default image markers, which break in Vite builds.
const pin = L.divIcon({
  className: '',
  html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#a87a50;border:3px solid #13284b;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
});

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

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
      L.marker(ll, { icon: pin })
        .addTo(map)
        .bindPopup(`<strong>${esc(b.name)}</strong><br/>${esc(b.address)}<br/><a href="/branches/${encodeURIComponent(b.id)}">Details</a>`);
    });
    if (withCoords.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    return () => {
      map.remove();
    };
  }, [branches]);

  const missing = (branches ?? []).filter((b) => typeof b.latitude !== 'number' || typeof b.longitude !== 'number');

  return (
    <div className="space-y-4">
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
