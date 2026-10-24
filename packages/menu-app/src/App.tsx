import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from './i18n';
import axios from 'axios';
import { ContactButtons } from './lib/ContactButtons';
import { getTodayHours, isOpenNow } from './lib/hours';
import { buildJsonLd, setMetaDescription, setPageTitle } from './lib/seo';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'qrcode';
import { readFavs, toggleFav } from './lib/favorites';
import { TableService } from './TableService';
import { NotifyButton } from './NotifyButton';
import { AddToOrder, TableOrder, groupsOf, unitPrice, useCart, type CartLine, type ChoiceGroup } from './TableOrder';
import { bestDiscount, discounted, isLive, type HappyHour } from './lib/happyHour';
import { timing, whenLabel } from './lib/offers';
import type { Combo } from './lib/combos';
import { Crescent, useRamadan } from './lib/season';
import { motion, useReducedMotion } from 'motion/react';
import { PUBLIC_ORIGIN, isNative, linkDeviceToCard, scanNative } from './lib/native';
import { GroupCartBar, StartGroup, groupCode } from './GroupOrder';

// API Base URL - will work through nginx reverse proxy
const API_BASE_URL = '/api';

interface Branch {
  id: string;
  code: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  operating_hours?: Record<string, any>;
  whatsapp_number?: string;
  ordering_enabled?: boolean;
  pickup_enabled?: boolean;
  google_maps_url?: string;
  google_review_url?: string;
  delivery_links?: Record<string, string>;
  cover_image_url?: string;
  logo_image_url?: string;
  status: string;
  wait_minutes?: number | null;    // Feature 13 - estimated wait time
  story_photos?: string[];         // Feature 8  - branch story highlights
}

interface Category {
  id: string;
  name: string;
  description?: string;
  display_order: number;
  icon_url?: string;
  is_active: boolean;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  name_ar?: string;
  description: string;
  description_ar?: string;
  category_id: string;
  base_price: number;
  image_url?: string;
  status: string;
  display_order: number;
  is_new?: boolean;
  is_popular?: boolean;
  is_seasonal?: boolean;
  nutritional_info?: Record<string, any>;
  dietary_tags?: string[];
  allergens?: string[];
  variants?: ProductVariant[];
  option_groups?: ChoiceGroup[];
  pairs_with?: string[]; // product IDs that pair well (Feature 7)
}

interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  display_order: number;
  options?: { choices?: { name: string; price_adjustment: number }[] } | null;
}

interface ProductAvailability {
  id: string;
  branch_id: string;
  product_id: string;
  is_available: boolean;
  last_updated_at: string;
}

// Where a scanned Milestones QR should take the guest. Returns null for anything we do not recognise.
export function routeForScan(text: string): string | null {
  // Offer posters: /offers?promo=<id>
  const promo = text.match(/\/offers\?[^#]*\bpromo=([a-f0-9-]{36})\b/i);
  if (promo) return `/offers?promo=${promo[1]}`;
  // Branch QR (menu link) or the older branch:<id> text format.
  const branch = text.match(/[?&]branch=([a-f0-9-]+)/i) ?? text.match(/branch:([a-f0-9-]+)/i);
  if (!branch) return null;
  // Feedback QR: /?branch=<id>&feedback=1
  if (/[?&;]feedback=1\b/i.test(text)) return `/feedback?branch=${branch[1]}`;
  const table = text.match(/[?&;]table[=:]([\w-]{1,20})/i);
  return menuPath(branch[1], table ? table[1] : null);
}

function menuPath(branchId: string, table: string | null): string {
  return `/menu/${branchId}${table && /^[\w-]{1,20}$/.test(table) ? `?table=${table}` : ''}`;
}

export function QRScannerPage({ onRoute }: { onRoute: (path: string) => void }) {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [manualBranchId, setManualBranchId] = useState('');
  const [manualTable, setManualTable] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    axios
      .get<{ id: string; name: string }[]>(`${API_BASE_URL}/branches`)
      .then((r) => setBranches(r.data))
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (!scanning) return;

    if (isNative) return;
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        // Accepts the menu link (?branch=<id>&table=<n>) and the older branch:<id> text format
        // Counter self-stamp code: open the rewards card, which adds the stamp.
        const stamp = decodedText.match(/[?&]stamp=([a-f0-9-]{8,64}(?:\.|%2E)[A-Z2-9]{8})\b/i);
        if (stamp) {
          scanner.clear().catch(() => {});
          window.location.href = `/loyalty?stamp=${stamp[1]}`;
          return;
        }
        const route = routeForScan(decodedText);
        if (route) {
          scanner.clear().catch(() => {});
          setScanning(false);
          onRoute(route);
        } else {
          setError('Invalid QR code format. Please scan a Milestones Coffee QR code.');
        }
      },
      () => {
        // Continue scanning even on errors
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [scanning, onRoute]);

  // App: the phone's own scanner, same QR rules as above.
  const scanWithPhone = async () => {
    setError(null);
    const text = await scanNative();
    if (!text) return;
    const stamp = text.match(/[?&]stamp=([a-f0-9-]{8,64}(?:\.|%2E)[A-Z2-9]{8})\b/i);
    if (stamp) {
      window.location.href = `/loyalty?stamp=${stamp[1]}`;
      return;
    }
    const route = routeForScan(text);
    if (!route) return setError('Invalid QR code format. Please scan a Milestones Coffee QR code.');
    onRoute(route);
  };

  const handleManualEntry = () => {
    if (manualBranchId) onRoute(menuPath(manualBranchId, manualTable.trim() || null));
  };

  return (
    <div className="flex justify-center">
      <div className="w-full bg-white rounded-2xl shadow-sm p-5">
        {isNative ? (
          <button type="button" onClick={scanWithPhone} className="mb-6 w-full rounded-xl bg-brand-700 py-4 text-lg font-semibold text-white">
            Scan table QR
          </button>
        ) : (
          <div id="qr-reader" className="mb-6 rounded-lg overflow-hidden border-2 border-brand-200"></div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or choose your branch</span>
          </div>
        </div>

        <div className="space-y-2">
          <select
            value={manualBranchId}
            onChange={(e) => setManualBranchId(e.target.value)}
            aria-label="Branch"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-500"
          >
            <option value="">{branches.length ? 'Choose a branch' : 'Loading branches…'}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={manualTable}
              onChange={(e) => setManualTable(e.target.value)}
              placeholder="Table number (optional)"
              maxLength={20}
              aria-label="Table number"
              className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleManualEntry()}
            />
            <button
              type="button"
              onClick={handleManualEntry}
              disabled={!manualBranchId}
              className="shrink-0 px-5 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-600 font-medium disabled:opacity-50"
            >
              Go
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          Enable camera to scan QR code from your branch
        </p>
      </div>
    </div>
  );
}

// Nutrition to show for a product, e.g. [['Calories', '190 kcal'], ...]; only values the cafe has entered.
function nutritionOf(p: Product): [string, string][] {
  const n = p.nutritional_info ?? {};
  const rows: [string, unknown, string][] = [
    ['Calories', n.calories, ' kcal'],
    ['Caffeine', n.caffeine_mg, ' mg'],
    ['Sugar', n.sugar_g, ' g'],
    ['Protein', n.protein_g, ' g'],
  ];
  return rows.filter(([, v]) => typeof v === 'number').map(([label, v, unit]) => [label, `${v}${unit}`]);
}

// ── Feature 1: Image Lightbox ─────────────────────────────────────────────────
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const startDist = useRef<number | null>(null);
  const startScale = useRef(1);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      startDist.current = Math.hypot(dx, dy);
      startScale.current = scale;
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && startDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const next = Math.max(1, Math.min(4, startScale.current * (dist / startDist.current)));
      setScale(next);
    }
  }, []);

  const handleTouchEnd = useCallback(() => { startDist.current = null; }, []);

  // Swipe down to close
  const touchStartY = useRef<number | null>(null);
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) touchStartY.current = e.touches[0].clientY;
  }, []);
  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current !== null && e.changedTouches.length === 1) {
      if (e.changedTouches[0].clientY - touchStartY.current > 80 && scale <= 1) onClose();
      touchStartY.current = null;
    }
  }, [onClose, scale]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      onClick={() => { if (scale <= 1) onClose(); }}
      onTouchStart={(e) => { handleTouchStart(e); handleSwipeStart(e); }}
      onTouchMove={handleTouchMove}
      onTouchEnd={(e) => { handleTouchEnd(); handleSwipeEnd(e); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Fullscreen view of ${alt}`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/20 text-white text-2xl hover:bg-white/30"
        aria-label="Close"
      >
        ×
      </button>
      {scale > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setScale(1); }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/20 px-4 py-2 text-sm text-white"
        >
          Reset zoom
        </button>
      )}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        style={{ transform: `scale(${scale})`, transformOrigin: 'center', transition: scale === 1 ? 'transform 0.2s' : 'none', maxWidth: '100vw', maxHeight: '100vh', objectFit: 'contain' }}
      />
    </div>,
    document.body,
  );
}

// ── Feature 5: Notify me when available ──────────────────────────────────────
const NOTIFY_KEY = 'milestones_notify_products';
function readNotifyList(): string[] {
  try { return JSON.parse(localStorage.getItem(NOTIFY_KEY) ?? '[]'); } catch { return []; }
}
function toggleNotify(productId: string): string[] {
  const list = readNotifyList();
  const next = list.includes(productId) ? list.filter((x) => x !== productId) : [...list, productId];
  try { localStorage.setItem(NOTIFY_KEY, JSON.stringify(next)); } catch { /* noop */ }
  return next;
}

// ── Feature 12: Print-friendly menu helper ───────────────────────────────────
function PrintMenuButton({ products, branchName }: { products: Product[]; branchName: string }) {
  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${branchName} — Menu</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 32px; color: #1a1a2e; }
  h1 { font-size: 28px; border-bottom: 2px solid #c97a2f; padding-bottom: 8px; }
  .item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #ddd; }
  .item-name { font-weight: 600; }
  .item-desc { font-size: 13px; color: #555; margin-top: 2px; }
  .item-price { font-weight: 700; color: #c97a2f; white-space: nowrap; }
  @media print { body { padding: 16px; } }
</style></head><body>
<h1>☕ ${branchName} — Menu</h1>
<p style="color:#888;font-size:13px">Printed ${new Date().toLocaleDateString()}</p>
${products.filter(p => p.status === 'active').map(p => `
<div class="item">
  <div><div class="item-name">${p.name}${p.name_ar ? ` · ${p.name_ar}` : ''}</div>
  ${p.description ? `<div class="item-desc">${p.description}</div>` : ''}</div>
  <div class="item-price">${Number(p.base_price).toFixed(2)} AED</div>
</div>`).join('')}
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };
  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:border-brand-300 print:hidden"
      title="Download / print menu"
    >
      🖨 Print menu
    </button>
  );
}

function ProductDetailsModal({
  product,
  onClose,
  availability,
  branchId,
  onAdd,
  deal,
  loved,
  relatedProducts,
  lang,
}: {
  product: Product;
  onClose: () => void;
  availability: boolean;
  branchId: string | null;
  onAdd?: (line: Omit<CartLine, 'key'>) => void;
  deal?: { percent: number; title: string; until: string | null } | null;
  loved?: number; // % thumbs up, when the item is "Most loved"
  relatedProducts?: Product[];
  lang?: string;
}) {
  const [lightbox, setLightbox] = useState(false);
  const [notifyList, setNotifyList] = useState(readNotifyList);
  const [calcQty, setCalcQty] = useState(1);
  const { t } = useLang();
  // Count the product as viewed (feeds "Top products" in the admin Insights page).
  useEffect(() => {
    fetch(`${API_BASE_URL}/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'product_selected', product_id: product.id, ...(branchId ? { branch_id: branchId } : {}) }),
    }).catch(() => {});
  }, [product.id, branchId]);

  // Rendered on <body> so the phone's bottom navigation cannot cover the buttons.
  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        {product.image_url && (
          <div className="relative">
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-64 object-cover cursor-zoom-in"
              onClick={() => setLightbox(true)}
              title="Tap to zoom"
            />
            <span className="absolute bottom-2 right-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white">🔍 Tap to zoom</span>
          </div>
        )}
        {lightbox && product.image_url && (
          <ImageLightbox src={product.image_url} alt={product.name} onClose={() => setLightbox(false)} />
        )}

        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              {/* Feature 14: bilingual name */}
              <h2 className="text-2xl font-bold text-gray-900">
                {lang === 'ar' && product.name_ar ? product.name_ar : product.name}
              </h2>
              {lang === 'ar' && product.name_ar && (
                <p className="text-sm text-gray-400">{product.name}</p>
              )}
              {product.is_new && (
                <span className="inline-block mt-2 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                  New
                </span>
              )}
              {product.is_popular && (
                <span className="inline-block mt-2 ml-2 px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
                  Popular
                </span>
              )}
              {product.is_seasonal && (
                <span className="inline-block mt-2 ml-2 px-3 py-1 bg-copper-500 text-white text-xs font-semibold rounded-full">
                  Limited time
                </span>
              )}
              {loved && (
                <span className="inline-block mt-2 ml-2 px-3 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full">
                  ❤ {t('lovedBadge')} · {t('lovedLiked').replace('{n}', String(loved))}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Feature 14: bilingual description */}
          <p className="text-gray-600 mb-2">
            {lang === 'ar' && product.description_ar ? product.description_ar : product.description}
          </p>
          {lang === 'ar' && product.description_ar && product.description && (
            <p className="text-xs text-gray-400 mb-4">{product.description}</p>
          )}
          {!(lang === 'ar' && product.description_ar) && <div className="mb-4" />}

          {/* Feature 3: Share + Feature 5: Notify me */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={() => {
                  navigator.share({
                    title: product.name,
                    text: product.description,
                    url: `${window.location.origin}${window.location.pathname}?product=${product.id}`,
                  }).catch(() => {});
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
              >
                <span>🔗</span> Share
              </button>
            )}
            {!availability && (
              <button
                type="button"
                onClick={() => {
                  const next = toggleNotify(product.id);
                  setNotifyList(next);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${notifyList.includes(product.id) ? 'bg-brand-700 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
              >
                <span>{notifyList.includes(product.id) ? '✅' : '🔔'}</span>
                {notifyList.includes(product.id) ? "We'll notify you" : 'Notify me when available'}
              </button>
            )}
          </div>

          {product.dietary_tags && product.dietary_tags.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Dietary Info:</p>
              <div className="flex flex-wrap gap-2">
                {(product.dietary_tags ?? []).map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {product.allergens && product.allergens.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 rounded-lg">
              <p className="text-sm font-semibold text-red-800 mb-1">Allergens:</p>
              <p className="text-xs text-red-700">{product.allergens.join(', ')}</p>
            </div>
          )}

          {nutritionOf(product).length > 0 && (
            <dl className="mb-4 grid grid-cols-4 gap-2 rounded-lg bg-cream p-3 text-center" aria-label="Nutrition per serving">
              {nutritionOf(product).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</dt>
                  <dd className="font-semibold text-brand-900">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* Feature 4: Calorie calculator — multiply servings to see total */}
          {typeof product.nutritional_info?.calories === 'number' && (
            <div className="mb-4 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
              <p className="text-xs font-semibold text-green-700 mb-2">🧮 Calorie calculator</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setCalcQty((q) => Math.max(1, q - 1))} className="grid h-7 w-7 place-items-center rounded-full bg-white border border-green-200 text-green-700 font-bold hover:bg-green-100">−</button>
                <span className="w-5 text-center font-bold text-green-800">{calcQty}</span>
                <button type="button" onClick={() => setCalcQty((q) => Math.min(10, q + 1))} className="grid h-7 w-7 place-items-center rounded-full bg-white border border-green-200 text-green-700 font-bold hover:bg-green-100">+</button>
                <span className="ml-2 text-sm text-green-700">= <strong>{Math.round(product.nutritional_info!.calories * calcQty)} kcal</strong></span>
                {typeof product.nutritional_info?.protein === 'number' && (
                  <span className="text-xs text-green-600">· {(product.nutritional_info.protein * calcQty).toFixed(0)}g protein</span>
                )}
              </div>
            </div>
          )}

          <div className="mb-6">
            {deal ? (
              <p className="text-3xl font-bold text-copper-700">
                {discounted(Number(product.base_price), deal.percent).toFixed(2)} AED{' '}
                <s className="text-lg font-medium text-gray-400">{Number(product.base_price).toFixed(2)}</s>
                <span className="ml-2 align-middle rounded-full bg-copper-500 px-2 py-0.5 text-xs font-semibold text-white">−{deal.percent}%</span>
              </p>
            ) : (
              <p className="text-3xl font-bold text-brand-600">{Number(product.base_price).toFixed(2)} AED</p>
            )}
          </div>

          {/* Feature 7: Related / pairs-with products in modal */}
          {relatedProducts && relatedProducts.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">🤝 Pairs well with</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {relatedProducts.map((rp) => (
                  <button
                    key={rp.id}
                    type="button"
                    onClick={() => { onClose(); setTimeout(() => {/* parent sets selectedProduct */}, 0); }}
                    className="flex-shrink-0 text-left rounded-xl border border-gray-100 bg-gray-50 p-2 w-28 hover:border-brand-200"
                  >
                    {rp.image_url && <img src={rp.image_url} alt={rp.name} className="w-full h-16 object-cover rounded-lg mb-1" />}
                    <p className="text-[11px] font-semibold text-gray-800 line-clamp-2">{lang === 'ar' && rp.name_ar ? rp.name_ar : rp.name}</p>
                    <p className="text-[11px] text-brand-600 font-bold">{Number(rp.base_price).toFixed(2)} AED</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {onAdd ? (
              <AddToOrder
                product={product}
                discount={deal?.percent}
                available={availability}
                onAdd={(line) => {
                  onAdd(line);
                  // Save to "order again" list
                  try {
                    const prev: string[] = JSON.parse(localStorage.getItem('milestones_order_again') ?? '[]');
                    const next = [product.id, ...prev.filter((x) => x !== product.id)].slice(0, 5);
                    localStorage.setItem('milestones_order_again', JSON.stringify(next));
                  } catch { /* noop */ }
                  onClose();
                }}
              />
            ) : (
              !availability && <p className="w-full py-3 rounded-lg text-center font-semibold bg-gray-100 text-gray-500">Currently Unavailable</p>
            )}
            <button
              onClick={onClose}
              className="w-full py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MenuPage({ branchId, table, onBack }: { branchId: string | null; table: string | null; onBack: () => void }) {
  const { t, lang, setLang } = useLang();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [showDietary, setShowDietary] = useState<string | null>(null);
  const [showFlag, setShowFlag] = useState<'new' | 'seasonal' | 'ramadan' | null>(null);
  const ramadan = useRamadan();
  const [sortBy, setSortBy] = useState<'menu' | 'price_asc' | 'price_desc'>('menu');
  const [favs, setFavs] = useState<string[]>(readFavs);
  const [menuImage, setMenuImage] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  // Happy-hour deals for this branch; re-checked every minute so prices change on time.
  const [deals, setDeals] = useState<HappyHour[]>([]);
  const [combos, setCombos] = useState<(Combo & { id: string })[]>([]);
  const [comboNote, setComboNote] = useState<string | null>(null);
  // "Most loved": items guests rated thumbs up after collecting their order.
  const [loved, setLoved] = useState<Record<string, number>>({});
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/ratings/loved`)
      .then((r) => setLoved(Object.fromEntries((Array.isArray(r.data) ? r.data : []).map((x: { product_id: string; percent: number }) => [x.product_id, x.percent]))))
      .catch(() => undefined);
  }, []);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/promotions`, { params: branchId ? { branch_id: branchId } : {} })
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setDeals(list.filter((p: HappyHour) => p.discount_percent));
        setCombos(list.filter((p: Combo) => p.combo_price && (p.combo_product_ids ?? []).length >= 2));
      })
      .catch(() => setDeals([]));
  }, [branchId]);
  const dealFor = (p: Product) => bestDiscount(deals, p.category_id, new Date(now));
  // "Order again": rebuild a past line from today's menu, prices and happy hour; null if gone or sold out.
  const reprice = (l: Omit<CartLine, 'key'>): Omit<CartLine, 'key'> | null => {
    const p = products.find((x) => x.id === l.product_id);
    if (!p || availability[p.id] === false) return null;
    const groups = groupsOf(p);
    const choices = Object.fromEntries(
      groups.map((g) => [g.id, (g.options!.choices!.find((c) => c.name === l.choices[g.id]) ?? g.options!.choices![0]).name]),
    );
    const deal = dealFor(p);
    const base = unitPrice(p, choices);
    return { ...l, name: p.name, choices, labels: groups.map((g) => choices[g.id]), unit: deal ? discounted(base, deal.percent) : base };
  };
  // From the Offers page: /menu?deal=<offer id> shows just that deal's items, with its banner.
  const [dealId, setDealId] = useState(() => new URLSearchParams(window.location.search).get('deal'));
  const focus = dealId ? (deals as (HappyHour & { id: string })[]).find((d) => d.id === dealId) : undefined;
  const focusCats = (focus?.category_ids ?? []).filter(Boolean);
  useEffect(() => {
    if (dealId) window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // From the Offers page: /menu/<branch>?combo=<offer id> puts the combo's items in the order once.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('combo');
    const c = id ? combos.find((x) => x.id === id) : undefined;
    // Same rules as canOrder / canPickup below; wait until the menu has loaded.
    const ordering = table ? !!branch?.ordering_enabled : !!branch?.pickup_enabled;
    if (loading || !c || !products.length || !branchId || !ordering) return;
    const lines = (c.combo_product_ids ?? []).map((pid) => reprice({ product_id: pid, name: '', qty: 1, unit: 0, choices: {}, labels: [], note: '' }));
    lines.forEach((l) => l && cart.add(l));
    setComboNote(lines.every(Boolean) ? t('comboAdded').replace('{t}', c.title) : t('comboSomeMissing'));
    const url = new URL(window.location.href);
    url.searchParams.delete('combo');
    window.history.replaceState(null, '', url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combos, products, branch, loading]);
  const pickCategory = (id: string | null) => {
    setDealId(null);
    setSelectedCategory(id);
  };
  // Opened from a group order link: the cart holds this person's items for the group.
  const [group] = useState(() => (table ? null : groupCode(new URLSearchParams(window.location.search).get('group'))));
  const cart = useCart(branchId ?? '', group ? `group-${group}` : (table ?? 'pickup'));

  useEffect(() => {
    const loadMenuData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (branchId) {
        // Load branch details
        const branchRes = await axios.get(`${API_BASE_URL}/branches/${branchId}`);
        setBranch(branchRes.data);
        setPageTitle(branchRes.data.name);
        setMetaDescription(`Menu for ${branchRes.data.name}, ${branchRes.data.address}`);
        } else {
          setBranch(null);
          setPageTitle('All branches');
          setMetaDescription('Full Milestones Coffee menu for all branches');
        }

        // Poster/menu image saved for this branch (optional)
        if (branchId) {
          try {
            const imgRes = await axios.get(`${API_BASE_URL}/branches/${branchId}/menu-image`);
            setMenuImage(imgRes.data?.data_url ?? null);
          } catch {
            setMenuImage(null);
          }
        } else {
          setMenuImage(null);
        }

        // Load categories
        const categoriesRes = await axios.get(`${API_BASE_URL}/categories`);
        setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);

        // Load products
        const productsRes = await axios.get(`${API_BASE_URL}/products`);
        const list: Product[] = Array.isArray(productsRes.data) ? productsRes.data : [];
        setProducts(list);
        // Deep link from "Find your drink": /menu?item=<product id> opens that item.
        const item = new URLSearchParams(window.location.search).get('item');
        const linked = item ? list.find((p) => p.id === item) : undefined;
        if (linked) setSelectedProduct(linked);

        if (branchId) {
          // Load availability for this branch
          const availRes = await axios.get(
            `${API_BASE_URL}/branches/${branchId}/products/availability`
          );
          const availMap: Record<string, boolean> = {};
          (Array.isArray(availRes.data) ? availRes.data : []).forEach((item: ProductAvailability) => {
            availMap[item.product_id] = item.is_available;
          });
          setAvailability(availMap);

          // Track analytics - page view
          await axios.post(`${API_BASE_URL}/analytics/events`, {
            event_type: 'page_view',
            branch_id: branchId,
          }).catch(() => {});
        } else {
          setAvailability({});
        }
      } catch (err) {
        console.error('Error loading menu data:', err);
        setError('Failed to load menu. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadMenuData();
  }, [branchId]);

  // Structured data for search engines (schema.org), added once the branch loads.
  useEffect(() => {
    if (!branch) return;
    const tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.id = 'branch-jsonld';
    tag.textContent = JSON.stringify(buildJsonLd(branch as any));
    document.getElementById('branch-jsonld')?.remove();
    document.head.appendChild(tag);
    return () => tag.remove();
  }, [branch]);

  const getFilteredProducts = () => {
    let filtered = products;

    if (focusCats.length) filtered = filtered.filter((p) => focusCats.includes(p.category_id));

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category_id === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by availability
    if (showOnlyAvailable) {
      filtered = filtered.filter((p) => availability[p.id] !== false);
    }

    if (showFlag === 'new') filtered = filtered.filter((p) => p.is_new);
    if (showFlag === 'seasonal') filtered = filtered.filter((p) => p.is_seasonal);
    if (showFlag === 'ramadan') filtered = filtered.filter((p) => ramadan?.featured_category_ids.includes(p.category_id));

    // Filter by dietary tags
    if (showDietary) {
      filtered = filtered.filter((p) =>
        p.dietary_tags?.includes(showDietary)
      );
    }

    if (sortBy === 'price_asc') return [...filtered].sort((a, b) => Number(a.base_price) - Number(b.base_price));
    if (sortBy === 'price_desc') return [...filtered].sort((a, b) => Number(b.base_price) - Number(a.base_price));
    // Hearted drinks first, then the menu order.
    const favRank = (id: string) => (favs.includes(id) ? 0 : 1);
    return [...filtered].sort((a, b) => favRank(a.id) - favRank(b.id) || a.display_order - b.display_order);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚙️</div>
          <p className="text-brand-600">{t('loadingMenu')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={onBack}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
          >
            Try Another Branch
          </button>
        </div>
      </div>
    );
  }

  if (menuImage && !showText) {
    return (
      <div className="min-h-screen bg-brand-50">
        <div className="max-w-md mx-auto p-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">☕ {branch?.name || 'Menu'}</h1>
            <button onClick={onBack} className="text-sm text-brand-700 font-semibold">← Branches</button>
          </div>
          <img src={menuImage} alt={`${branch?.name ?? 'Branch'} menu`} className="w-full rounded-lg shadow bg-white" />
          <button
            onClick={() => setShowText(true)}
            className="mt-4 w-full py-3 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700"
          >
            View text menu
          </button>
        </div>
      </div>
    );
  }

  const filteredProducts = getFilteredProducts();
  const canOrder = !!(table && branchId && branch?.ordering_enabled);
  const canPickup = !!(!table && branchId && branch?.pickup_enabled);

  return (
    <div className="min-h-screen bg-brand-50">
      {/* Header */}
      <div className="bg-white border-b border-brand-200 md:sticky md:top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">☕ {branch?.name || 'Menu'}</h1>
              <p className="text-sm text-gray-600">
                {table && <span className="mr-2 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-brand-800 font-semibold">Table {table}</span>}
                {branch?.address}
              </p>
              {branch && (
                <p className="text-sm mt-1">
                  {(() => {
                    const open = isOpenNow(branch.operating_hours, branch.timezone || 'Asia/Dubai', new Date());
                    const today = getTodayHours(branch.operating_hours, branch.timezone || 'Asia/Dubai', new Date());
                    if (open === null) return <span className="text-gray-500">Hours unavailable</span>;
                    return (
                      <>
                        <span className={open ? 'font-semibold text-green-700' : 'font-semibold text-gray-600'}>
                          {open ? 'Open now' : 'Closed'}
                        </span>
                        {today && <span className="text-gray-600"> · Today {today.open}–{today.close}</span>}
                      </>
                    );
                  })()}
                </p>
              )}
              <div className="mt-3">
                <ContactButtons branch={branch} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold"
              >
                {lang === 'en' ? 'العربية' : 'English'}
              </button>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {t('changeBranch')}
            </button>
            </div>
          </div>

          {branchId && <FeedbackForm branchId={branchId} />}

          {/* Search Bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <a href="/find-your-drink" className="mt-2 inline-block text-sm font-semibold text-copper-700 hover:underline">
              ✨ {t('quizLink')}
            </a>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
              <input
                type="checkbox"
                checked={showOnlyAvailable}
                onChange={(e) => setShowOnlyAvailable(e.target.checked)}
              />
              <span className="text-sm font-medium text-gray-700">{t('availableOnly')}</span>
            </label>

            {(
              [
                ['new', 'New'],
                ['seasonal', 'Limited time'],
                ['ramadan', 'Iftar & Suhoor'],
              ] as const
            )
              .filter(([flag]) =>
                products.some((p) => (flag === 'new' ? p.is_new : flag === 'seasonal' ? p.is_seasonal : ramadan?.featured_category_ids.includes(p.category_id))),
              )
              .map(([flag, label]) => (
                <button
                  key={flag}
                  type="button"
                  aria-pressed={showFlag === flag}
                  onClick={() => setShowFlag(showFlag === flag ? null : flag)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    showFlag === flag ? 'bg-copper-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}

            {['Vegan', 'Gluten-Free', 'Dairy-Free'].map((dietary) => (
              <button
                key={dietary}
                onClick={() => setShowDietary(showDietary === dietary ? null : dietary)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  showDietary === dietary
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {dietary}
              </button>
            ))}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700"
              aria-label="Sort products"
            >
              <option value="menu">Menu order</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Categories */}
        {categories.length > 0 && (
          <div className="mb-8 overflow-x-auto">
            <div className="flex gap-2 pb-2">
              <button
                onClick={() => pickCategory(null)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
                  selectedCategory === null
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-brand-300'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => pickCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
                    selectedCategory === cat.id
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-brand-300'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {ramadan && (
          <div role="status" className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-900 to-brand-700 px-5 py-4 text-white">
            <Crescent className="h-8 w-8 shrink-0 text-copper-300" />
            <div>
              <p className="font-semibold">{ramadan.greeting}</p>
              {ramadan.note && <p className="text-sm text-brand-100">{ramadan.note}</p>}
            </div>
          </div>
        )}

        {comboNote && (
          <p role="status" className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-green-50 px-5 py-4 font-semibold text-green-800">
            🎁 {comboNote}
            <button type="button" onClick={() => setComboNote(null)} aria-label="Close" className="text-green-700">
              ✕
            </button>
          </p>
        )}

        {focus && (() => {
          const at = timing(focus, new Date(now));
          return (
            <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-gradient-to-r from-copper-500 to-[#7a5230] px-5 py-4 text-white">
              <span className="text-2xl font-bold">−{focus.discount_percent}%</span>
              <div className="min-w-[12rem] flex-1">
                <p className="font-semibold">{focus.title}</p>
                <p className="text-sm text-cream/90">
                  {at.live
                    ? `${t('happyHourNow')}${focus.end_time ? ` · ${t('happyHourUntil').replace('{t}', focus.end_time)}` : ''}`
                    : at.next
                      ? t('dealStarts').replace('{t}', whenLabel(at.next, new Date(now)))
                      : t('dealOver')}
                </p>
              </div>
              <button type="button" onClick={() => setDealId(null)} className="w-full rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25 sm:w-auto">
                {t('dealShowAll')} ✕
              </button>
            </div>
          );
        })()}

        {!focus && (() => {
          const live = deals.filter((d) => isLive(d, new Date(now)));
          if (!live.length) return null;
          const d = live.sort((a, b) => (b.discount_percent ?? 0) - (a.discount_percent ?? 0))[0];
          return (
            <div role="status" className="mb-6 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-copper-500 to-[#7a5230] px-5 py-4 text-white">
              <span className="text-2xl font-bold">−{d.discount_percent}%</span>
              <div>
                <p className="font-semibold">{d.title}</p>
                <p className="text-sm text-cream/90">
                  {t('happyHourNow')}
                  {d.end_time ? ` · ${t('happyHourUntil').replace('{t}', d.end_time)}` : ''}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Feature 2: Order-again banner */}
        {(() => {
          const raw = (() => { try { return JSON.parse(localStorage.getItem('milestones_order_again') ?? '[]'); } catch { return []; } })();
          const items: Product[] = (Array.isArray(raw) ? raw as string[] : [])
            .map((id: string) => products.find((p) => p.id === id && availability[p.id] !== false))
            .filter(Boolean) as Product[];
          if (!items.length) return null;
          return (
            <div className="mb-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">🔁 Order again</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {items.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProduct(p)}
                    className="flex-shrink-0 flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 shadow-sm hover:border-brand-300"
                  >
                    {p.image_url && <img src={p.image_url} alt="" className="h-6 w-6 rounded-full object-cover" />}
                    {lang === 'ar' && p.name_ar ? p.name_ar : p.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Feature 6: Trending now */}
        {(() => {
          const trending = [...products]
            .filter((p) => p.is_popular && availability[p.id] !== false)
            .slice(0, 3);
          if (!trending.length) return null;
          return (
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 p-4">
              <p className="mb-3 text-sm font-bold text-orange-700">🔥 Trending now</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {trending.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProduct(p)}
                    className="flex-shrink-0 text-left rounded-xl bg-white shadow p-2 w-32"
                  >
                    {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-20 object-cover rounded-lg mb-1" />}
                    <p className="text-xs font-semibold text-gray-800 line-clamp-2">{lang === 'ar' && p.name_ar ? p.name_ar : p.name}</p>
                    <p className="text-[10px] text-orange-600 font-bold">#{i + 1} this week</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Feature 13: Estimated wait time */}
        {branch && typeof branch.wait_minutes === 'number' && branch.wait_minutes !== null && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            ⏱ Est. wait: {branch.wait_minutes} min
          </div>
        )}

        {/* Feature 8: Branch story highlights */}
        {branch && (branch.story_photos ?? []).length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">📸 Branch highlights</p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {branch.story_photos!.map((url, i) => (
                <img key={i} src={url} alt={`Branch photo ${i + 1}`} className="h-24 w-24 flex-shrink-0 rounded-xl object-cover shadow" />
              ))}
            </div>
          </div>
        )}

        {/* Feature 10: Birthday countdown */}
        {(() => {
          const raw = (() => { try { return localStorage.getItem('milestones_birthday'); } catch { return null; } })();
          if (!raw) return null;
          const bd = new Date(raw);
          if (isNaN(bd.getTime())) return null;
          const today = new Date();
          const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
          if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
          const days = Math.ceil((thisYear.getTime() - today.getTime()) / 86400000);
          if (days > 30) return null;
          return (
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-pink-100 to-rose-50 px-5 py-3 text-rose-700">
              <span className="text-2xl">🎂</span>
              <div>
                <p className="font-semibold text-sm">{days === 0 ? '🎉 Happy birthday! Your bonus is active today.' : `Your birthday bonus activates in ${days} day${days === 1 ? '' : 's'}!`}</p>
                <p className="text-xs text-rose-500">Show this to our team for your special treat.</p>
              </div>
            </div>
          );
        })()}

        {/* Feature 9: Loyalty widget inline */}
        {(() => {
          const raw = (() => { try { return JSON.parse(localStorage.getItem('milestones_loyalty_snapshot') ?? 'null'); } catch { return null; } })();
          if (!raw || typeof raw.stamps !== 'number') return null;
          return (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-700 mb-1">☕ Your loyalty stamps</p>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: Math.max(raw.stamps_target ?? 10, 10) }).map((_, i) => (
                    <span key={i} className={`text-lg leading-none ${i < raw.stamps ? 'opacity-100' : 'opacity-20'}`}>☕</span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-brand-700">{raw.stamps}</p>
                <p className="text-[11px] text-gray-500">of {raw.stamps_target ?? 10}</p>
              </div>
            </div>
          );
        })()}

        {/* Feature 12: Print menu */}
        {products.length > 0 && (
          <div className="mb-4 flex justify-end">
            <PrintMenuButton products={products} branchName={branch?.name ?? 'Milestones Coffee'} />
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const isAvailable = availability[product.id] !== false;
              return (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer overflow-hidden"
                >
                  {product.image_url && (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">
                        {/* Feature 14: bilingual card name */}
                        {lang === 'ar' && product.name_ar ? product.name_ar : product.name}
                        {product.is_new && <span className="ml-2 align-middle rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">New</span>}
                        {product.is_seasonal && (
                          <span className="ml-2 align-middle rounded-full bg-copper-500 px-2 py-0.5 text-[11px] font-semibold text-white">Limited time</span>
                        )}
                        {loved[product.id] && (
                          <span title={t('lovedLiked').replace('{n}', String(loved[product.id]))} className="ml-2 align-middle rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                            ❤ {t('lovedBadge')}
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-1">
                        {/* Feature 3: Share on card */}
                        {typeof navigator !== 'undefined' && 'share' in navigator && (
                          <button
                            type="button"
                            aria-label="Share"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.share({ title: product.name, text: product.description, url: `${window.location.origin}${window.location.pathname}?product=${product.id}` }).catch(() => {});
                            }}
                            className="text-base leading-none text-gray-400 hover:text-brand-600 px-0.5"
                          >
                            🔗
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={favs.includes(product.id) ? 'Remove from favourites' : 'Add to favourites'}
                          aria-pressed={favs.includes(product.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFavs(toggleFav(product.id));
                          }}
                          className="text-xl leading-none text-copper-700 px-1"
                        >
                          {favs.includes(product.id) ? '♥' : '♡'}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {lang === 'ar' && product.description_ar ? product.description_ar : product.description}
                    </p>
                    {/* Feature 7: Bundle/pairs-with chip */}
                    {(product.pairs_with ?? []).length > 0 && (() => {
                      const first = products.find((p) => p.id === product.pairs_with![0]);
                      if (!first) return null;
                      return (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedProduct(first); }}
                          className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                        >
                          🤝 Pairs well with {lang === 'ar' && first.name_ar ? first.name_ar : first.name} →
                        </button>
                      );
                    })()}
                    {typeof product.nutritional_info?.calories === 'number' && (
                      <p className="-mt-2 mb-3 text-xs text-gray-500">{product.nutritional_info.calories} kcal</p>
                    )}
                    <div className="flex items-center justify-between">
                      {dealFor(product) ? (
                        <span className="text-lg font-bold text-copper-700">
                          {discounted(Number(product.base_price), dealFor(product)!.percent).toFixed(2)} AED{' '}
                          <s className="text-sm font-medium text-gray-400">{Number(product.base_price).toFixed(2)}</s>
                        </span>
                      ) : (
                        <span className="text-lg font-bold text-brand-600">
                          {Number(product.base_price).toFixed(2)} AED
                          {focus?.discount_percent && (
                            <span className="block text-xs font-semibold text-copper-700">
                              {discounted(Number(product.base_price), focus.discount_percent).toFixed(2)} AED {focus.start_time ? t('dealFrom').replace('{t}', focus.start_time) : ''}
                            </span>
                          )}
                        </span>
                      )}
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          isAvailable
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">{t('noProducts')}</p>
          </div>
        )}
      </div>

      {table && branchId && branch && (
        <>
          <div className={canOrder ? 'h-44' : 'h-28'} aria-hidden="true" />
          <TableService
            extra={canOrder ? <TableOrder branchId={branchId} table={table} cart={cart} reprice={reprice} combos={combos} /> : null}
            branchId={branchId}
            branchName={branch.name}
            table={table}
            whatsapp={branch.whatsapp_number}
            picks={products.filter((p) => favs.includes(p.id)).map((p) => p.name).slice(0, 10)}
          />
        </>
      )}

      {canPickup && (
        <>
          <div className="h-32" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-[72px] md:bottom-4 z-40 px-3">
            <div className="mx-auto max-w-md rounded-2xl border border-brand-100 bg-white p-3 pb-1 shadow-[0_12px_32px_rgba(10,26,51,0.18)]">
              {group ? (
                <GroupCartBar code={group} cart={cart} />
              ) : (
                <>
                  {cart.count === 0 && <StartGroup branchId={branchId!} />}
                  <TableOrder branchId={branchId!} table={null} cart={cart} hours={branch?.operating_hours} timezone={branch?.timezone || 'Asia/Dubai'} reprice={reprice} combos={combos} />
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Product Details Modal */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          availability={availability[selectedProduct.id] !== false}
          branchId={branchId}
          deal={dealFor(selectedProduct)}
          loved={loved[selectedProduct.id]}
          onAdd={canOrder || canPickup ? cart.add : undefined}
          relatedProducts={(selectedProduct.pairs_with ?? []).map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[]}
          lang={lang}
        />
      )}
    </div>
  );
}

export function FeedbackForm({ branchId }: { branchId: string }) {
  const { t } = useLang();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function submit() {
    if (rating < 1) return;
    setStatus('sending');
    try {
      await axios.post(`${API_BASE_URL}/branches/${branchId}/feedback`, { rating, comment });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return <p className="text-sm text-green-700 mb-4">{t('feedbackThanks')}</p>;
  }

  return (
    <div className="mb-4 rounded-lg bg-white border p-3">
      <p className="text-sm font-semibold text-gray-800 mb-2">{t('feedbackQuestion')}</p>
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => setRating(n)}
            className={`text-2xl ${n <= rating ? 'text-amber-500' : 'text-gray-300'}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        maxLength={500}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('feedbackPlaceholder')}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        rows={2}
      />
      <div className="flex items-center justify-between mt-2">
        {status === 'error' ? <span className="text-xs text-red-600">{t('feedbackError')}</span> : <span />}
        <button
          type="button"
          onClick={submit}
          disabled={rating < 1 || status === 'sending'}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {status === 'sending' ? t('sending') : t('send')}
        </button>
      </div>
    </div>
  );
}

const LOYALTY_KEY = 'milestones_loyalty_token';

export function LoyaltyCard() {
  const { t, lang } = useLang();
  const reduceMotion = useReducedMotion();
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LOYALTY_KEY);
    } catch {
      return null;
    }
  });
  const [card, setCard] = useState<{
    name: string | null;
    stamps: number;
    target: number;
    redeemed_count: number;
    reward_name?: string;
    referral_code?: string;
    referral_bonus?: number;
    has_birthday?: boolean;
    double_now?: boolean;
    tier?: 'bronze' | 'silver' | 'gold';
    tier_perk?: string;
    visits_year?: number;
    next_tier?: 'silver' | 'gold' | null;
    next_tier_at?: number | null;
    challenge?: { target: number; bonus: number; visits: number; done: boolean } | null;
    history?: { type: 'enroll' | 'stamp' | 'redeem' | 'adjust' | 'bonus'; delta: number; created_at: string }[];
  } | null>(null);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Invite code from a friend's link: /loyalty?ref=CODE
  const [ref] = useState(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('ref') ?? '';
      return /^[A-Z0-9]{6,12}$/i.test(v) ? v.toUpperCase() : '';
    } catch {
      return '';
    }
  });

  // Counter code from /loyalty?stamp=<branch>.<code>, scanned at the till.
  const [stampCode, setStampCode] = useState(() => {
    try {
      const v = decodeURIComponent(new URLSearchParams(window.location.search).get('stamp') ?? '');
      return /^[a-f0-9-]{8,64}\.[A-Z2-9]{8}$/i.test(v) ? v : '';
    } catch {
      return '';
    }
  });
  const [stampNote, setStampNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!token || !stampCode) return;
    const code = stampCode;
    setStampCode('');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('stamp');
      window.history.replaceState(null, '', url.pathname + url.search);
    } catch {
      /* keep the URL as is */
    }
    setStampNote({ ok: true, text: t('loyaltySelfAdding') });
    axios
      .post(`${API_BASE_URL}/loyalty/self-stamp`, { token, code })
      .then((r) => {
        setStampNote(
          r.data.ok
            ? { ok: true, text: t('loyaltySelfAdded').replace('{n}', String(r.data.earned ?? 1)).replace('{b}', r.data.branch_name ?? 'Milestones') }
            : { ok: false, text: r.data.message ?? 'Could not add your stamp.' },
        );
        loadCard();
      })
      .catch((err) => setStampNote({ ok: false, text: err?.response?.data?.message || 'Could not add your stamp. Please ask our staff.' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, stampCode]);

  // QR that staff scan to add a stamp. Encodes the card's secret token.
  useEffect(() => {
    if (!token) return;
    QRCode.toDataURL(`MSQ-CARD:${token}`, { margin: 1, width: 220, color: { dark: '#13284b', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [token]);

  function loadCard() {
    if (!token) return;
    axios
      .get(`${API_BASE_URL}/loyalty/card/${token}`)
      .then((r) => {
        setCard(r.data);
        // Cache a snapshot for the inline loyalty widget on the menu page
        try {
          localStorage.setItem('milestones_loyalty_snapshot', JSON.stringify({ stamps: r.data.stamps, stamps_target: r.data.target }));
        } catch { /* noop */ }
      })
      .catch(() => {
        try {
          localStorage.removeItem(LOYALTY_KEY);
        } catch {
          /* storage unavailable */
        }
        setToken(null);
      });
  }

  // Delete the card and everything tied to it (store rule: accounts can be deleted in the app).
  async function deleteCard() {
    if (!token || !window.confirm(t('loyaltyDeleteConfirm'))) return;
    setBusy(true);
    try {
      await axios.post(`${API_BASE_URL}/loyalty/card/${token}/delete`);
      try {
        localStorage.removeItem(LOYALTY_KEY);
      } catch {
        /* storage unavailable */
      }
      setCard(null);
      setToken(null);
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Could not delete the card. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function saveBirthday() {
    if (!token || !birthday) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await axios.patch(`${API_BASE_URL}/loyalty/card/${token}/birthday`, { birthday });
      if (!res.data.ok) setMessage(res.data.message);
      loadCard();
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Could not save your birthday.');
    } finally {
      setBusy(false);
    }
  }

  async function shareInvite() {
    if (!card?.referral_code) return;
    const url = `${PUBLIC_ORIGIN}/loyalty?ref=${card.referral_code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Milestones Coffee', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* share cancelled or clipboard blocked */
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadCard, [token]);

  async function enroll() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/loyalty/enroll`, { phone, name, birthday: birthday || undefined, ref: ref || undefined });
      if (res.data.ok) {
        try {
          localStorage.setItem(LOYALTY_KEY, res.data.token);
        } catch {
          /* storage unavailable */
        }
        setToken(res.data.token);
        linkDeviceToCard();
      } else {
        setMessage(res.data.message);
      }
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Could not create your card. Check the number.');
    } finally {
      setBusy(false);
    }
  }

  if (token && card) {
    const dots = Array.from({ length: card.target }, (_, i) => i < card.stamps);
    return (
      <div className="mb-4 rounded-lg bg-white border p-3">
        <p className="text-sm font-semibold text-gray-800 mb-2">
          {t('loyaltyCardTitle')}{card.name ? ` · ${card.name}` : ''}
        </p>
        {card.tier && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  card.tier === 'gold' ? 'bg-amber-100 text-amber-800' : card.tier === 'silver' ? 'bg-slate-200 text-slate-700' : 'bg-orange-50 text-orange-800'
                }`}
              >
                {t(card.tier === 'gold' ? 'tierGold' : card.tier === 'silver' ? 'tierSilver' : 'tierBronze')}
              </span>
              {card.tier_perk && <span className="text-xs text-gray-600">{card.tier_perk}</span>}
              <span className="w-full text-xs text-gray-500">
                {card.next_tier && card.next_tier_at != null
                  ? t('tierNext')
                      .replace('{n}', String(Math.max(1, card.next_tier_at - (card.visits_year ?? 0))))
                      .replace('{t}', t(card.next_tier === 'gold' ? 'tierGold' : 'tierSilver'))
                  : t('tierTopReached')}
              </span>
            </div>
            {/* Feature 11: Tier progress bar */}
            {card.next_tier && card.next_tier_at != null && (
              <div className="mb-3">
                <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                  <span>{t(card.tier === 'silver' ? 'tierSilver' : 'tierBronze')}</span>
                  <span>{t(card.next_tier === 'gold' ? 'tierGold' : 'tierSilver')}</span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${card.next_tier === 'gold' ? 'bg-amber-400' : 'bg-slate-400'}`}
                    style={{ width: `${Math.min(100, ((card.visits_year ?? 0) / card.next_tier_at!) * 100).toFixed(1)}%` }}
                  />
                </div>
                <p className="mt-1 text-center text-[11px] text-gray-400">
                  {card.visits_year ?? 0} / {card.next_tier_at} visits
                </p>
              </div>
            )}
          </>
        )}
        {card.challenge && (
          <div className="mb-3 rounded border border-brand-100 bg-brand-50 p-2">
            <p className="text-xs font-semibold text-brand-800">{t('challengeTitle')}</p>
            <p className="text-xs text-gray-700">
              {card.challenge.done
                ? t('challengeDone')
                : t('challengeText').replace('{n}', String(card.challenge.target)).replace('{b}', String(card.challenge.bonus))}
            </p>
            <div className="mt-1.5 flex gap-1" aria-label={`${card.challenge.visits} / ${card.challenge.target}`}>
              {Array.from({ length: card.challenge.target }, (_, i) => (
                <span key={i} className={`h-2 flex-1 rounded-full ${i < card.challenge!.visits ? 'bg-copper-500' : 'bg-white border border-brand-100'}`} />
              ))}
            </div>
          </div>
        )}
        {stampNote && (
          <p role="status" className={`mb-2 rounded p-2 text-sm font-semibold ${stampNote.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
            {stampNote.text}
          </p>
        )}
        {card.double_now && (
          <p className="mb-2 rounded bg-amber-50 p-2 text-xs font-semibold text-amber-800">{t('loyaltyDoubleNow')}</p>
        )}
        {qr && (
          <div className="mb-3 flex items-center gap-3">
            <img src={qr} alt="" width={110} height={110} className="h-28 w-28 rounded border" />
            <p className="text-xs text-gray-600">{t('loyaltyShowQr')}</p>
          </div>
        )}
        <div className="grid grid-cols-5 gap-2 mb-2 max-w-xs">
          {dots.map((filled, i) => (
            <motion.div
              key={i}
              className={`aspect-square rounded-full flex items-center justify-center text-sm ${
                filled ? 'bg-copper-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}
              initial={reduceMotion || !filled ? false : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, delay: filled ? i * 0.06 : 0, ease: 'backOut' }}
            >
              {filled ? '☕' : i + 1}
            </motion.div>
          ))}
        </div>
        <p className="text-xs text-gray-600">
          {card.stamps}/{card.target} {t('loyaltyStamps')}
        </p>
        {card.stamps >= card.target ? (
          <p className="mt-2 rounded bg-amber-50 p-2 text-sm font-semibold text-amber-800">{t('loyaltyReady')}</p>
        ) : (
          <p className="mt-2 text-xs text-gray-600">{t('loyaltyToGo').replace('{n}', String(card.target - card.stamps))}</p>
        )}
        {card.redeemed_count > 0 && (
          <p className="mt-1 text-xs text-gray-500">{t('loyaltyRedeemed').replace('{n}', String(card.redeemed_count))}</p>
        )}
        {card.reward_name && <p className="mt-1 text-xs text-gray-500">{t('loyaltyReward').replace('{r}', card.reward_name)}</p>}
        {card.has_birthday === false && (
          <div className="mt-3 border-t pt-2">
            <p className="text-xs font-semibold text-gray-700 mb-1">{t('loyaltyAddBirthday')}</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={saveBirthday}
                disabled={busy || !birthday}
                className="shrink-0 px-3 py-1 bg-brand-700 text-white rounded text-sm font-semibold disabled:opacity-50"
              >
                {t('loyaltySave')}
              </button>
            </div>
            {message && <p className="mt-1 text-xs text-amber-700">{message}</p>}
          </div>
        )}
        <NotifyButton token={token} />
        {card.referral_code && (card.referral_bonus ?? 0) > 0 && (
          <div className="mt-3 border-t pt-2">
            <p className="text-xs font-semibold text-gray-700">{t('loyaltyInvite')}</p>
            <p className="text-xs text-gray-600 mt-0.5">{t('loyaltyInviteText').replace('{n}', String(card.referral_bonus))}</p>
            <button type="button" onClick={shareInvite} className="mt-2 px-3 py-1.5 rounded bg-copper-700 text-white text-xs font-semibold">
              {copied ? t('loyaltyCopied') : t('loyaltyShare')}
            </button>
          </div>
        )}
        {card.history && card.history.length > 0 && (
          <div className="mt-3 border-t pt-2">
            <p className="text-xs font-semibold text-gray-700 mb-1">{t('loyaltyActivity')}</p>
            <ul className="space-y-1">
              {card.history.slice(0, 5).map((h, i) => (
                <li key={i} className="flex justify-between gap-3 text-xs text-gray-600">
                  <span>
                    {t(
                      {
                        stamp: 'loyaltyEvStamp',
                        redeem: 'loyaltyEvRedeem',
                        adjust: 'loyaltyEvAdjust',
                        bonus: 'loyaltyEvBonus',
                        enroll: 'loyaltyEvEnroll',
                      }[h.type],
                    )}
                    {(h.type === 'adjust' || h.type === 'bonus' || (h.type === 'stamp' && h.delta > 1)) &&
                      ` (${h.delta > 0 ? '+' : ''}${h.delta})`}
                  </span>
                  <span className="text-gray-400">
                    {new Date(h.created_at).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-GB', {
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'Asia/Dubai',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" onClick={deleteCard} disabled={busy} className="mt-4 text-xs font-semibold text-red-700 underline">
          {t('loyaltyDelete')}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg bg-white border p-3 space-y-2">
      <p className="text-sm font-semibold text-gray-800">{t('loyaltyTitle')}</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('loyaltyName')}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={t('loyaltyPhone')}
        inputMode="tel"
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
      />
      <label className="block text-xs text-gray-600">
        {t('loyaltyBirthday')}
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </label>
      {stampCode && <p className="rounded bg-amber-50 p-2 text-xs font-semibold text-amber-800">{t('loyaltySelfJoin')}</p>}
      {ref && <p className="text-xs text-green-700">{t('loyaltyJoinedRef')}</p>}
      {message && <p className="text-xs text-amber-700">{message}</p>}
      <button
        type="button"
        onClick={enroll}
        disabled={busy || phone.trim().length < 7}
        className="w-full py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
      >
        {busy ? t('loyaltyCreating') : t('loyaltyCreate')}
      </button>
    </div>
  );
}
