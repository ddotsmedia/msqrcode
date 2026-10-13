import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { api } from '../api';

interface Branch {
  id: string;
  code: string;
  name: string;
}

export interface QrRow {
  id: string;
  branch_id: string;
  kind: 'branch' | 'table';
  table_number: string | null;
  label: string;
  caption: string;
  foreground: string;
  background: string;
  is_active: boolean;
  has_artwork: boolean;
  payload: string;
  branch: { id: string; name: string; code: string };
}

interface QrForm {
  id: string | null;
  branch_id: string;
  kind: 'branch' | 'table';
  table_number: string;
  label: string;
  caption: string;
  foreground: string;
  background: string;
}

type KindFilter = 'all' | 'branch' | 'table';

const DEFAULT_CAPTION = 'Scan to view the menu';

const MENU_URL = (
  (import.meta.env.VITE_MENU_URL as string | undefined) ?? 'https://coffeesales.ae'
).replace(/\/$/, '');
const MENU_HOST = MENU_URL.replace(/^https?:\/\//, '');

// Must match the API: a web link that opens the branch menu (and the table, if given).
export function payloadFor(branchId: string, kind: 'branch' | 'table', table: string): string {
  const base = `${MENU_URL}/?branch=${branchId}`;
  return kind === 'table' && table ? `${base}&table=${encodeURIComponent(table)}` : base;
}

function qrOptions(fg: string, bg: string) {
  return { margin: 2, errorCorrectionLevel: 'M' as const, color: { dark: fg, light: bg } };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fileBase(row: QrRow): string {
  return `${row.branch.code}-${row.kind === 'table' ? `table-${row.table_number}` : 'branch'}`;
}

function triggerDownload(href: string, name: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

async function downloadPng(row: QrRow): Promise<void> {
  const url = await QRCode.toDataURL(row.payload, { width: 1024, ...qrOptions(row.foreground, row.background) });
  triggerDownload(url, `qr-${fileBase(row)}.png`);
}

async function downloadSvg(row: QrRow): Promise<void> {
  const svg = await QRCode.toString(row.payload, { type: 'svg', ...qrOptions(row.foreground, row.background) });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  triggerDownload(url, `qr-${fileBase(row)}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function printSheet(rows: QrRow[]): Promise<void> {
  const win = window.open('', '_blank');
  if (!win) return;
  const cards = await Promise.all(
    rows.map(async (r) => {
      const svg = await QRCode.toString(r.payload, { type: 'svg', ...qrOptions(r.foreground, r.background) });
      const where = r.kind === 'table' ? `${r.branch.name} · Table ${esc(r.table_number ?? '')}` : esc(r.branch.name);
      return `<div class="card"><div class="qr">${svg}</div><h2>${esc(r.label)}</h2><p>${esc(r.caption)}</p><small>${where}</small></div>`;
    }),
  );
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR codes</title><style>
  @page { size: A4; margin: 12mm; }
  body { font-family: system-ui, sans-serif; margin: 0; color: #111; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
  .card { border: 1px solid #ddd; border-radius: 4mm; padding: 5mm; text-align: center; break-inside: avoid; }
  .qr svg { width: 100%; height: auto; display: block; }
  h2 { font-size: 13px; margin: 3mm 0 1mm; }
  p { font-size: 11px; color: #444; margin: 0; }
  small { font-size: 10px; color: #888; }
  </style></head><body><div class="grid">${cards.join('')}</div>
  <script>window.onload = function () { window.print(); };<\/script></body></html>`);
  win.document.close();
}

type PosterSize = 'A4' | 'A3';

async function printPosters(rows: QrRow[], size: PosterSize): Promise<void> {
  const win = window.open('', '_blank');
  if (!win) return;
  const posters = await Promise.all(
    rows.map(async (r) => {
      const svg = await QRCode.toString(r.payload, { type: 'svg', ...qrOptions(r.foreground, r.background) });
      const table = r.kind === 'table' ? `<p class="table">Table ${esc(r.table_number ?? '')}</p>` : '';
      return `<section class="poster">
        <p class="brand">Milestones Coffee</p>
        <h1>${esc(r.branch.name)}</h1>
        ${table}
        <h2>Scan for our menu</h2>
        <div class="qr">${svg}</div>
        <p class="caption">${esc(r.caption)}</p>
        <p class="host">${esc(MENU_HOST)}</p>
      </section>`;
    }),
  );
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Menu posters</title><style>
  @page { size: ${size}; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; color: #111; background: #fff; }
  .poster { height: var(--h); width: 100%; padding: 18mm; display: flex; flex-direction: column;
            align-items: center; justify-content: center; text-align: center; page-break-after: always; }
  .poster:last-child { page-break-after: auto; }
  .brand { font-size: calc(var(--t) * 0.45); letter-spacing: 0.2em; text-transform: uppercase; color: #666; margin: 0; }
  h1 { font-size: var(--t); margin: 3mm 0 2mm; }
  .table { font-size: calc(var(--t) * 0.8); font-weight: 700; margin: 0 0 2mm; }
  h2 { font-size: calc(var(--t) * 0.6); margin: 4mm 0 6mm; font-weight: 600; }
  .qr svg { width: var(--qr); height: auto; display: block; }
  .caption { font-size: calc(var(--t) * 0.4); color: #333; margin: 6mm 0 1mm; }
  .host { font-size: calc(var(--t) * 0.35); color: #888; margin: 0; }
  .A4 { --h: 297mm; --qr: 115mm; --t: 36px; }
  .A3 { --h: 420mm; --qr: 170mm; --t: 56px; }
  </style></head><body class="${size}">${posters.join('')}
  <script>window.onload = function () { window.print(); };<\/script></body></html>`);
  win.document.close();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image'));
    img.src = src;
  });
}

interface Placement {
  x: number; // centre of the QR, % of poster width
  y: number; // centre of the QR, % of poster height
  size: number; // QR width, % of poster width
}

// Draws the poster artwork with the branch QR placed on it. Returns a PNG data URL.
async function composePoster(artUrl: string, row: QrRow, pos: Placement, maxWidth?: number): Promise<string> {
  const art = await loadImage(artUrl);
  const scale = maxWidth && art.naturalWidth > maxWidth ? maxWidth / art.naturalWidth : 1;
  const w = Math.round(art.naturalWidth * scale);
  const h = Math.round(art.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser');
  ctx.drawImage(art, 0, 0, w, h);

  const qrUrl = await QRCode.toDataURL(row.payload, { width: 1024, ...qrOptions(row.foreground, row.background) });
  const qr = await loadImage(qrUrl);
  const qrW = (w * pos.size) / 100;
  const x = (w * pos.x) / 100 - qrW / 2;
  const y = (h * pos.y) / 100 - qrW / 2;
  ctx.drawImage(qr, x, y, qrW, qrW);
  return canvas.toDataURL('image/png');
}

type Target = 'original' | 'A4' | 'A3' | 'screen';

// Longest side in pixels: 300 dpi for A4 / A3 print, 2000 px for screens.
const TARGET_LONG_SIDE: Record<Target, number> = { original: Infinity, A4: 3508, A3: 4961, screen: 2000 };
const TARGET_LABEL: Record<Target, string> = {
  original: 'Keep original size',
  A4: 'A4 print (300 dpi)',
  A3: 'A3 print (300 dpi)',
  screen: 'Screen / web',
};

interface ArtInfo {
  origW: number;
  origH: number;
  origKb: number;
  outW: number;
  outH: number;
  outKb: number;
  optimised: boolean;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), type, quality),
  );
}

// Resizes to the target size and compresses to JPEG. Returns the file unchanged when optimising is off.
async function optimizeArtwork(file: File, target: Target, optimize: boolean): Promise<{ blob: Blob; info: ArtInfo }> {
  const srcUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(srcUrl);
    const longSide = Math.max(img.naturalWidth, img.naturalHeight);
    const max = TARGET_LONG_SIDE[target];
    const shouldResize = optimize && longSide > max;
    const scale = shouldResize ? max / longSide : 1;
    const outW = Math.round(img.naturalWidth * scale);
    const outH = Math.round(img.naturalHeight * scale);

    // Re-encode only when it helps: resizing, or converting a PNG to a smaller JPEG.
    let blob: Blob = file;
    if (optimize && (shouldResize || file.type !== 'image/jpeg')) {
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available in this browser');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, 0, 0, outW, outH);
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
    }

    return {
      blob,
      info: {
        origW: img.naturalWidth,
        origH: img.naturalHeight,
        origKb: Math.round(file.size / 1024),
        outW,
        outH,
        outKb: Math.round(blob.size / 1024),
        optimised: optimize,
      },
    };
  } finally {
    URL.revokeObjectURL(srcUrl);
  }
}

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(blob);
  });
}

interface SavedArtwork {
  name: string | null;
  data_url: string | null;
  x: number | null;
  y: number | null;
  size: number | null;
}

function PosterDesigner({
  row,
  token,
  onClose,
  onChanged,
}: {
  row: QrRow;
  token: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [artUrl, setArtUrl] = useState<string | null>(null); // artwork currently shown
  const [artName, setArtName] = useState('');
  const [artFile, setArtFile] = useState<File | null>(null); // a newly uploaded file, not yet optimised
  const [artInfo, setArtInfo] = useState<ArtInfo | null>(null);
  const [autoOptimize, setAutoOptimize] = useState(true);
  const [target, setTarget] = useState<Target>('original');
  const [optimising, setOptimising] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(row.has_artwork);
  const [dirty, setDirty] = useState(false); // changes not saved to the branch yet
  const [pos, setPos] = useState<Placement>({ x: 80, y: 85, size: 22 });
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [printSize, setPrintSize] = useState<PosterSize>('A4');
  const [saving, setSaving] = useState(false);

  // Load the menu image already saved for this branch code.
  useEffect(() => {
    if (!row.has_artwork) return;
    let live = true;
    api<SavedArtwork>(`/admin/qr-codes/${row.id}/artwork`, token)
      .then((a) => {
        if (!live || !a.data_url) return;
        setArtUrl(a.data_url);
        setArtName(a.name ?? 'menu-image');
        if (a.x != null && a.y != null && a.size != null) setPos({ x: a.x, y: a.y, size: a.size });
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoadingSaved(false);
      });
    return () => {
      live = false;
    };
  }, [row.id, row.has_artwork, token]);

  // Free temporary object URLs when they are replaced.
  useEffect(() => {
    return () => {
      if (artUrl?.startsWith('blob:')) URL.revokeObjectURL(artUrl);
    };
  }, [artUrl]);

  // Optimise a newly uploaded file whenever its settings change.
  useEffect(() => {
    if (!artFile) return;
    let live = true;
    setOptimising(true);
    optimizeArtwork(artFile, target, autoOptimize)
      .then(({ blob, info }) => {
        if (!live) return;
        setArtUrl(URL.createObjectURL(blob));
        setArtInfo(info);
        setDirty(true);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setOptimising(false);
      });
    return () => {
      live = false;
    };
  }, [artFile, target, autoOptimize]);

  // Live preview: artwork with the QR placed on it.
  useEffect(() => {
    if (!artUrl) {
      setPreview(null);
      return;
    }
    let live = true;
    composePoster(artUrl, row, pos, 900)
      .then((url) => {
        if (live) setPreview(url);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [artUrl, row, pos]);

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setError('Use a PNG or JPG image. For a PDF poster, export it as an image first.');
      return;
    }
    setError(null);
    setNotice(null);
    setArtName(file.name);
    setArtFile(file);
  }

  function moveQr(key: keyof Placement, value: number) {
    setPos((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }

  async function saveToBranch() {
    if (!artUrl) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const dataUrl = await toDataUrl(artUrl);
      await api(`/admin/qr-codes/${row.id}/artwork`, token, {
        method: 'PUT',
        body: JSON.stringify({ data_url: dataUrl, name: artName || 'menu-image', x: pos.x, y: pos.y, size: pos.size }),
      });
      setDirty(false);
      setNotice('Saved. This menu image is now stored for this branch code.');
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeSaved() {
    if (!window.confirm('Remove the saved menu image for this code?')) return;
    setError(null);
    try {
      await api(`/admin/qr-codes/${row.id}/artwork`, token, { method: 'DELETE' });
      setArtUrl(null);
      setArtFile(null);
      setArtInfo(null);
      setArtName('');
      setDirty(false);
      setNotice('Saved menu image removed.');
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function downloadPoster() {
    if (!artUrl) return;
    setError(null);
    try {
      const url = await composePoster(artUrl, row, pos);
      triggerDownload(url, `poster-${fileBase(row)}.png`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function printPoster() {
    if (!artUrl) return;
    setError(null);
    try {
      const url = await composePoster(artUrl, row, pos);
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Poster</title><style>
        @page { size: ${printSize}; margin: 0; }
        html, body { margin: 0; padding: 0; }
        img { display: block; width: 100%; height: 100vh; object-fit: contain; }
      </style></head><body><img src="${url}" alt="Poster">
      <script>window.onload = function () { window.print(); };<\/script></body></html>`);
      win.document.close();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const slider = (label: string, key: keyof Placement, min: number, max: number) => (
    <label className="block text-xs font-semibold text-gray-700">
      {label}: {pos[key]}%
      <input
        type="range"
        min={min}
        max={max}
        value={pos[key]}
        onChange={(e) => moveQr(key, Number(e.target.value))}
        className="w-full"
      />
    </label>
  );

  return (
    <Modal title={`Poster · ${row.label}`} onClose={onClose}>
      <div className="space-y-4">
        {/* Actions first, so they are always visible */}
        <div className="rounded-lg border bg-gray-50 p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!artUrl || !dirty || saving || optimising}
              onClick={saveToBranch}
              className="bg-green-600 text-white rounded px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save to this branch'}
            </button>
            <button
              type="button"
              disabled={!artUrl || optimising}
              onClick={downloadPoster}
              className="bg-brand-600 text-white rounded px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Download poster (PNG)
            </button>
            <select
              value={printSize}
              onChange={(e) => setPrintSize(e.target.value as PosterSize)}
              className="border border-gray-300 rounded px-2 py-2 text-sm bg-white"
              aria-label="Print size"
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
            <button
              type="button"
              disabled={!artUrl || optimising}
              onClick={printPoster}
              className="bg-gray-900 text-white rounded px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Print poster
            </button>
          </div>
          {row.has_artwork && !artFile && !loadingSaved && (
            <button type="button" onClick={removeSaved} className="text-xs text-red-600 font-semibold">
              Remove saved menu image
            </button>
          )}
          {dirty && <p className="text-xs text-amber-700">Changes not saved yet. Click "Save to this branch" to keep them.</p>}
          {notice && <p className="text-xs text-green-700">{notice}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {artUrl ? 'Replace menu image (PNG or JPG)' : 'Upload menu image (PNG or JPG)'}
          </label>
          <input type="file" accept="image/png,image/jpeg" onChange={pickFile} className="text-sm" />
          {artName && <p className="text-xs text-gray-500 mt-1">{artName}</p>}
          {loadingSaved && <p className="text-xs text-gray-500 mt-1">Loading saved menu image…</p>}
        </div>

        {artFile && (
          <div className="rounded-lg border bg-gray-50 p-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 font-semibold text-gray-700">
                <input type="checkbox" checked={autoOptimize} onChange={(e) => setAutoOptimize(e.target.checked)} />
                Auto-resize and optimise
              </label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as Target)}
                disabled={!autoOptimize}
                className="border border-gray-300 rounded px-2 py-1 text-sm bg-white disabled:opacity-50"
                aria-label="Output size"
              >
                {(Object.keys(TARGET_LABEL) as Target[]).map((t) => (
                  <option key={t} value={t}>
                    {TARGET_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            {optimising && <p className="text-xs text-gray-500">Optimising…</p>}
            {artInfo && !optimising && (
              <p className="text-xs text-gray-600">
                {artInfo.optimised ? 'Optimised' : 'Original'}: {artInfo.outW}×{artInfo.outH} px, {artInfo.outKb} KB
                {artInfo.optimised && artInfo.origKb !== artInfo.outKb && (
                  <> (was {artInfo.origW}×{artInfo.origH} px, {artInfo.origKb} KB)</>
                )}
              </p>
            )}
            {artInfo && (target === 'A4' || target === 'A3') && Math.max(artInfo.origW, artInfo.origH) < TARGET_LONG_SIDE[target] && (
              <p className="text-xs text-amber-700">
                This image is smaller than the {target} print size, so it may look soft when printed.
              </p>
            )}
          </div>
        )}

        {error && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</p>}

        {preview ? (
          <>
            <img src={preview} alt="Poster preview" className="w-full rounded border bg-gray-50" />
            <p className="text-xs text-gray-500 text-center">This is what gets downloaded and printed.</p>
          </>
        ) : (
          <p className="text-sm text-gray-500 bg-gray-50 rounded p-6 text-center">
            {loadingSaved ? 'Loading…' : 'Upload a menu image to see the poster preview.'}
          </p>
        )}

        {artUrl && (
          <div className="grid grid-cols-3 gap-3">
            {slider('Left / right', 'x', 0, 100)}
            {slider('Up / down', 'y', 0, 100)}
            {slider('QR size', 'size', 8, 50)}
          </div>
        )}
      </div>
    </Modal>
  );
}

// Renders a QR preview as a PNG data URL for the given colours.
function QrImage({ payload, fg, bg, alt, className }: { payload: string; fg: string; bg: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(payload, { width: 512, ...qrOptions(fg, bg) })
      .then((url) => {
        if (live) setSrc(url);
      })
      .catch(() => {
        if (live) setSrc(null);
      });
    return () => {
      live = false;
    };
  }, [payload, fg, bg]);

  if (!src) return <div className={`${className ?? ''} bg-gray-100 rounded animate-pulse`} aria-label={alt} />;
  return <img src={src} alt={alt} className={className} />;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-500 text-2xl leading-none" aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm';

export default function QrCodesPage({ token }: { token: string }) {
  const [rows, setRows] = useState<QrRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [branchFilter, setBranchFilter] = useState('');
  const [kindFilter] = useState<KindFilter>('all');
  const [showPaused, setShowPaused] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [posterSize, setPosterSize] = useState<PosterSize>('A4');
  const [designFor, setDesignFor] = useState<QrRow | null>(null);

  const [form, setForm] = useState<QrForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [tablesOpen, setTablesOpen] = useState(false);
  const [tableRange, setTableRange] = useState({ branch_id: '', from: '1', to: '10' });
  const [tableError, setTableError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([api<QrRow[]>('/admin/qr-codes', token), api<Branch[]>('/branches', token)])
      .then(([qr, br]) => {
        setRows(qr);
        setBranches(br);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!branchFilter || r.branch_id === branchFilter) &&
        (kindFilter === 'all' || r.kind === kindFilter) &&
        (showPaused || r.is_active) &&
        (!q || `${r.label} ${r.branch.name} ${r.table_number ?? ''}`.toLowerCase().includes(q)),
    );
  }, [rows, branchFilter, kindFilter, showPaused, query]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.is_active).length,
      tables: rows.filter((r) => r.kind === 'table').length,
      paused: rows.filter((r) => !r.is_active).length,
    }),
    [rows],
  );

  const branchesWithoutCode = branches.filter((b) => !rows.some((r) => r.branch_id === b.id && r.kind === 'branch'));
  const chosen = visible.filter((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openNew(kind: 'branch' | 'table', branchId?: string) {
    setFormError(null);
    setForm({
      id: null,
      branch_id:
        branchId ||
        branches.find((b) => !rows.some((r) => r.branch_id === b.id && r.kind === 'branch'))?.id ||
        branchFilter ||
        branches[0]?.id ||
        '',
      kind,
      table_number: '',
      label: '',
      caption: DEFAULT_CAPTION,
      foreground: '#111111',
      background: '#ffffff',
    });
  }

  function openEdit(r: QrRow) {
    setFormError(null);
    setForm({
      id: r.id,
      branch_id: r.branch_id,
      kind: r.kind,
      table_number: r.table_number ?? '',
      label: r.label,
      caption: r.caption,
      foreground: r.foreground,
      background: r.background,
    });
  }

  async function saveForm(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      if (form.id) {
        await api(`/admin/qr-codes/${form.id}`, token, {
          method: 'PUT',
          body: JSON.stringify({
            label: form.label,
            caption: form.caption,
            foreground: form.foreground,
            background: form.background,
          }),
        });
      } else {
        await api('/admin/qr-codes', token, {
          method: 'POST',
          body: JSON.stringify({
            branch_id: form.branch_id,
            kind: form.kind,
            table_number: form.table_number,
            label: form.label,
            caption: form.caption,
            foreground: form.foreground,
            background: form.background,
          }),
        });
      }
      setForm(null);
      setNotice('QR code saved.');
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePaused(r: QrRow) {
    setError(null);
    try {
      if (r.is_active) {
        await api(`/admin/qr-codes/${r.id}`, token, { method: 'DELETE' });
      } else {
        await api(`/admin/qr-codes/${r.id}`, token, { method: 'PUT', body: JSON.stringify({ is_active: true }) });
      }
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function generateTables(e: FormEvent) {
    e.preventDefault();
    setTableError(null);
    try {
      const res = await api<{ created: number; skipped: number }>('/admin/qr-codes/tables', token, {
        method: 'POST',
        body: JSON.stringify({
          branch_id: tableRange.branch_id,
          from: Number(tableRange.from),
          to: Number(tableRange.to),
        }),
      });
      setTablesOpen(false);
      setNotice(`Created ${res.created} table code(s). Skipped ${res.skipped} that already exist.`);
      load();
    } catch (err) {
      setTableError((err as Error).message);
    }
  }

  const previewPayload = form ? payloadFor(form.branch_id, form.kind, form.table_number) : '';

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">QR codes</h2>
          <p className="text-sm text-gray-500">
            Each code opens a branch's menu. Use table codes to place one on every table.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openNew('branch')}
            className="bg-brand-600 text-white rounded px-3 py-2 text-sm font-semibold"
          >
            New QR code
          </button>
        </div>
      </div>

      {notice && (
        <p className="bg-green-50 text-green-800 rounded p-3 text-sm flex justify-between">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="font-semibold">
            Dismiss
          </button>
        </p>
      )}
      {error && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</p>}

      {branchesWithoutCode.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
          <p className="font-semibold">Branches without a branch QR code</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {branchesWithoutCode.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => openNew('branch', b.id)}
                className="bg-white border border-amber-300 rounded px-3 py-1 text-xs font-semibold"
              >
                + {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total codes" value={stats.total} />
        <Stat label="Active" value={stats.active} />
        <Stat label="Table codes" value={stats.tables} />
        <Stat label="Paused" value={stats.paused} />
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Search label or table…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[10rem] border border-gray-300 rounded px-3 py-2 text-sm"
        />
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="border border-gray-300 rounded px-2 py-2 text-sm">
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <label className="text-sm text-gray-600 flex items-center gap-1">
          <input type="checkbox" checked={showPaused} onChange={(e) => setShowPaused(e.target.checked)} />
          Show paused
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex gap-3 text-gray-600">
          <span>{visible.length} shown</span>
          <button type="button" onClick={() => setSelected(new Set(visible.map((r) => r.id)))} className="text-brand-700 font-semibold">
            Select all shown
          </button>
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="text-gray-500 font-semibold">
              Clear selection
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={posterSize}
            onChange={(e) => setPosterSize(e.target.value as PosterSize)}
            className="border border-gray-300 rounded px-2 py-2 text-sm bg-white"
            aria-label="Poster size"
          >
            <option value="A4">Poster A4</option>
            <option value="A3">Poster A3</option>
          </select>
          <button
            type="button"
            disabled={visible.length === 0}
            onClick={() => printPosters(chosen.length > 0 ? chosen : visible, posterSize)}
            className="bg-brand-600 text-white rounded px-3 py-2 font-semibold disabled:opacity-50"
          >
            {chosen.length > 0 ? `Print posters (${chosen.length})` : 'Print posters (all shown)'}
          </button>
          <button
            type="button"
            disabled={visible.length === 0}
            onClick={() => printSheet(chosen.length > 0 ? chosen : visible)}
            className="bg-gray-900 text-white rounded px-3 py-2 font-semibold disabled:opacity-50"
          >
            {chosen.length > 0 ? `Print sheet (${chosen.length})` : 'Print sheet'}
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading QR codes…</p>}
      {!loading && visible.length === 0 && (
        <p className="text-gray-500 text-sm bg-white rounded-xl border p-6 text-center">No QR codes match these filters.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((r) => (
          <article
            key={r.id}
            className={`bg-white rounded-xl border shadow-sm p-4 flex flex-col ${r.is_active ? '' : 'opacity-60'}`}
          >
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                Select
              </label>
              <div className="flex gap-1 text-xs">
                <span className="rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 font-semibold">
                  {r.kind === 'branch' ? 'Branch' : `Table ${r.table_number}`}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    r.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {r.is_active ? 'Active' : 'Paused'}
                </span>
              </div>
            </div>

            <QrImage
              payload={r.payload}
              fg={r.foreground}
              bg={r.background}
              alt={`QR code for ${r.label}`}
              className="mx-auto mt-3 w-44 h-44"
            />

            <h3 className="mt-3 text-center font-semibold text-gray-800">{r.label}</h3>
            <p className="text-center text-xs text-gray-500">
              {r.branch.name} · {r.branch.code}
            </p>

            <button
              type="button"
              onClick={() => setDesignFor(r)}
              className="mt-4 w-full bg-brand-600 text-white rounded-lg py-2 text-sm font-semibold"
            >
              Design poster (upload menu image)
            </button>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <button type="button" onClick={() => openEdit(r)} className="border rounded py-1.5 font-semibold text-gray-700">
                Edit
              </button>
              <button type="button" onClick={() => togglePaused(r)} className="border rounded py-1.5 font-semibold text-gray-700">
                {r.is_active ? 'Pause' : 'Activate'}
              </button>
              <button type="button" onClick={() => printPosters([r], posterSize)} className="border rounded py-1.5 font-semibold text-gray-700">
                Print QR only
              </button>
              <button type="button" onClick={() => downloadPng(r)} className="border rounded py-1.5 font-semibold text-gray-700">
                QR PNG
              </button>
              <button type="button" onClick={() => downloadSvg(r)} className="border rounded py-1.5 font-semibold text-gray-700">
                QR SVG
              </button>
            </div>
          </article>
        ))}
      </div>

      {designFor && (
        <PosterDesigner row={designFor} token={token} onClose={() => setDesignFor(null)} onChanged={load} />
      )}

      {form && (
        <Modal title={form.id ? 'Edit QR code' : 'New QR code'} onClose={() => setForm(null)}>
          <form onSubmit={saveForm} className="space-y-4">
            {!form.id && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Branch</label>
                  <select
                    required
                    value={form.branch_id}
                    onChange={(e) => {
                      setForm({ ...form, branch_id: e.target.value, kind: 'branch' });
                    }}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Choose a branch
                    </option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                {rows.some((r) => r.branch_id === form.branch_id && r.kind === 'branch') && (
                  <p className="bg-amber-50 text-amber-900 rounded p-3 text-sm">
                    This branch already has its menu QR code. Pick another branch, or use Design poster on its card.
                  </p>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Label</label>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className={inputClass}
                placeholder="Defaults to the branch name"
                maxLength={120}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Caption under the code</label>
              <input
                value={form.caption}
                onChange={(e) => setForm({ ...form, caption: e.target.value })}
                className={inputClass}
                maxLength={120}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-gray-700">
                Code colour
                <input
                  type="color"
                  value={form.foreground}
                  onChange={(e) => setForm({ ...form, foreground: e.target.value })}
                  className="mt-1 block h-10 w-full rounded border border-gray-300"
                />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Background
                <input
                  type="color"
                  value={form.background}
                  onChange={(e) => setForm({ ...form, background: e.target.value })}
                  className="mt-1 block h-10 w-full rounded border border-gray-300"
                />
              </label>
            </div>

            <div className="flex flex-col items-center bg-gray-50 rounded-lg p-4">
              {form.branch_id ? (
                <QrImage
                  payload={previewPayload}
                  fg={form.foreground}
                  bg={form.background}
                  alt="Preview"
                  className="w-40 h-40"
                />
              ) : (
                <p className="text-sm text-gray-500 py-12">Choose a branch to see the preview.</p>
              )}
              <p className="mt-2 text-sm font-semibold text-gray-800">{form.label || 'Label preview'}</p>
              <p className="text-xs text-gray-500">{form.caption}</p>
            </div>

            {formError && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{formError}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="border rounded px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || (!form.id && rows.some((r) => r.branch_id === form.branch_id && r.kind === 'branch'))}
                className="bg-brand-600 text-white rounded px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {tablesOpen && (
        <Modal title="Generate table codes" onClose={() => setTablesOpen(false)}>
          <form onSubmit={generateTables} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Branch</label>
              <select
                required
                value={tableRange.branch_id}
                onChange={(e) => setTableRange({ ...tableRange, branch_id: e.target.value })}
                className={inputClass}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">From table</label>
                <input type="number" min={1} required value={tableRange.from} onChange={(e) => setTableRange({ ...tableRange, from: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">To table</label>
                <input type="number" min={1} required value={tableRange.to} onChange={(e) => setTableRange({ ...tableRange, to: e.target.value })} className={inputClass} />
              </div>
            </div>
            <p className="text-xs text-gray-500">Up to 100 tables per run. Tables that already have a code are skipped.</p>
            {tableError && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{tableError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTablesOpen(false)} className="border rounded px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
              <button type="submit" className="bg-brand-600 text-white rounded px-4 py-2 text-sm font-semibold">
                Generate
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
