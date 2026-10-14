import { useEffect, useState } from 'react';
import axios from 'axios';
import { setPageTitle } from './lib/seo';

interface GalleryItem {
  src: string;
  alt: string;
  caption?: string;
}

// Photos are listed in public/gallery/gallery.json and stored in public/gallery/.
export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<GalleryItem | null>(null);
  setPageTitle('Gallery');

  useEffect(() => {
    axios
      .get<GalleryItem[]>('/gallery/gallery.json')
      .then((r) => setItems(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError(true));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Gallery</h1>
      {error && <p className="text-red-600">Could not load the gallery. Please try again.</p>}
      {!error && items === null && <p className="text-gray-500">Loading…</p>}
      {items && items.length === 0 && <p className="text-gray-600">Photos coming soon.</p>}
      {items && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((it) => (
            <button
              type="button"
              key={it.src}
              onClick={() => setOpen(it)}
              className="aspect-square overflow-hidden rounded-xl bg-gray-200 shadow-sm"
            >
              <img src={it.src} alt={it.alt} loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.alt}
          className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
          onClick={() => setOpen(null)}
        >
          <img src={open.src} alt={open.alt} className="max-h-[80vh] max-w-full rounded-lg" />
          {open.caption && <p className="text-white mt-3 text-center">{open.caption}</p>}
          <button type="button" className="mt-4 text-white underline" onClick={() => setOpen(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
