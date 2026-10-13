import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { ContactButtons } from './lib/ContactButtons';
import { getTodayHours, isOpenNow } from './lib/hours';
import { buildJsonLd, setMetaDescription, setPageTitle } from './lib/seo';
import { Html5QrcodeScanner } from 'html5-qrcode';

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
  google_maps_url?: string;
  google_review_url?: string;
  delivery_links?: Record<string, string>;
  cover_image_url?: string;
  logo_image_url?: string;
  status: string;
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
  description: string;
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
}

interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  display_order: number;
  options?: Record<string, any>;
}

interface ProductAvailability {
  id: string;
  branch_id: string;
  product_id: string;
  is_available: boolean;
  last_updated_at: string;
}

// Poster and phone-camera links look like /?branch=<id>&table=<n>; open the menu directly.
function readLaunchParams(): { branchId: string; table: string | null } | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const branchId = params.get('branch');
    if (branchId && /^[a-f0-9-]{8,}$/i.test(branchId)) {
      const table = params.get('table');
      return { branchId, table: table && /^[\w-]{1,20}$/.test(table) ? table : null };
    }
  } catch {
    // URL parsing unavailable: fall back to the scanner
  }
  return null;
}

function QRScannerPage({ onBranchDetected }: { onBranchDetected: (branchId: string, table: string | null) => void }) {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualBranchId, setManualBranchId] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!scanning) return;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        // Accepts the menu link (?branch=<id>&table=<n>) and the older branch:<id> text format
        const link = decodedText.match(/[?&]branch=([a-f0-9-]+)/i);
        const legacy = decodedText.match(/branch:([a-f0-9-]+)/i);
        const branchMatch = link ?? legacy;
        if (branchMatch) {
          const tableMatch = decodedText.match(/[?&;]table[=:]([\w-]{1,20})/i);
          scanner.clear().catch(() => {});
          setScanning(false);
          onBranchDetected(branchMatch[1], tableMatch ? tableMatch[1] : null);
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
  }, [scanning, onBranchDetected]);

  const handleManualEntry = () => {
    if (manualBranchId.trim()) {
      onBranchDetected(manualBranchId.trim(), null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-brand-800 mb-2">☕ Milestones</h1>
          <p className="text-brand-600">Digital Menu</p>
        </div>

        <div id="qr-reader" className="mb-6 rounded-lg overflow-hidden border-2 border-brand-200"></div>

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
            <span className="px-2 bg-white text-gray-500">Or enter branch ID</span>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={manualBranchId}
            onChange={(e) => setManualBranchId(e.target.value)}
            placeholder="Branch ID"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            onKeyPress={(e) => e.key === 'Enter' && handleManualEntry()}
          />
          <button
            onClick={handleManualEntry}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium"
          >
            Go
          </button>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          Enable camera to scan QR code from your branch
        </p>
      </div>
    </div>
  );
}

function ProductDetailsModal({
  product,
  onClose,
  availability,
}: {
  product: Product;
  onClose: () => void;
  availability: boolean;
}) {
  const handleAddToOrder = () => {
    // Track analytics
    fetch(`${API_BASE_URL}/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'product_selected',
        product_id: product.id,
      }),
    }).catch(() => {});

    alert(`${product.name} added to order! Please proceed to counter to complete purchase.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-64 object-cover"
          />
        )}

        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{product.name}</h2>
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
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          <p className="text-gray-600 mb-4">{product.description}</p>

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

          <div className="mb-6">
            <p className="text-3xl font-bold text-brand-600">{Number(product.base_price).toFixed(2)} AED</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleAddToOrder}
              disabled={!availability}
              className={`w-full py-3 rounded-lg font-semibold text-white transition ${
                availability
                  ? 'bg-brand-600 hover:bg-brand-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {availability ? 'Add to Order' : 'Currently Unavailable'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuPage({ branchId, table, onBack }: { branchId: string; table: string | null; onBack: () => void }) {
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
  const [menuImage, setMenuImage] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    const loadMenuData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load branch details
        const branchRes = await axios.get(`${API_BASE_URL}/branches/${branchId}`);
        setBranch(branchRes.data);
        setPageTitle(branchRes.data.name);
        setMetaDescription(`Menu for ${branchRes.data.name}, ${branchRes.data.address}`);

        // Poster/menu image saved for this branch (optional)
        try {
          const imgRes = await axios.get(`${API_BASE_URL}/branches/${branchId}/menu-image`);
          setMenuImage(imgRes.data?.data_url ?? null);
        } catch {
          setMenuImage(null);
        }

        // Load categories
        const categoriesRes = await axios.get(`${API_BASE_URL}/categories`);
        setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);

        // Load products
        const productsRes = await axios.get(`${API_BASE_URL}/products`);
        setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);

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

    // Filter by dietary tags
    if (showDietary) {
      filtered = filtered.filter((p) =>
        p.dietary_tags?.includes(showDietary)
      );
    }

    return filtered.sort((a, b) => a.display_order - b.display_order);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚙️</div>
          <p className="text-brand-600">Loading menu...</p>
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

  return (
    <div className="min-h-screen bg-brand-50">
      {/* Header */}
      <div className="bg-white border-b border-brand-200 sticky top-0 z-40">
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
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              ← Change Branch
            </button>
          </div>

          <LoyaltyCard />
          <FeedbackForm branchId={branchId} />

          {/* Search Bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
              <input
                type="checkbox"
                checked={showOnlyAvailable}
                onChange={(e) => setShowOnlyAvailable(e.target.checked)}
              />
              <span className="text-sm font-medium text-gray-700">Available Only</span>
            </label>

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
                onClick={() => setSelectedCategory(null)}
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
                  onClick={() => setSelectedCategory(cat.id)}
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
                    <h3 className="font-bold text-gray-900 mb-1">{product.name}</h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-brand-600">
                        {Number(product.base_price).toFixed(2)} AED
                      </span>
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
            <p className="text-gray-600 text-lg">No products found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Product Details Modal */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          availability={availability[selectedProduct.id] !== false}
        />
      )}
    </div>
  );
}

function FeedbackForm({ branchId }: { branchId: string }) {
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
    return <p className="text-sm text-green-700 mb-4">Thank you for your feedback!</p>;
  }

  return (
    <div className="mb-4 rounded-lg bg-white border p-3">
      <p className="text-sm font-semibold text-gray-800 mb-2">How was your visit?</p>
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
        placeholder="Tell us more (optional)"
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        rows={2}
      />
      <div className="flex items-center justify-between mt-2">
        {status === 'error' ? <span className="text-xs text-red-600">Could not send. Try again.</span> : <span />}
        <button
          type="button"
          onClick={submit}
          disabled={rating < 1 || status === 'sending'}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

const LOYALTY_KEY = 'milestones_loyalty_token';

function LoyaltyCard() {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LOYALTY_KEY);
    } catch {
      return null;
    }
  });
  const [card, setCard] = useState<{ name: string | null; stamps: number; target: number; redeemed_count: number } | null>(null);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_BASE_URL}/loyalty/card/${token}`)
      .then((r) => setCard(r.data))
      .catch(() => {
        try {
          localStorage.removeItem(LOYALTY_KEY);
        } catch {
          /* storage unavailable */
        }
        setToken(null);
      });
  }, [token]);

  async function enroll() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/loyalty/enroll`, { phone, name });
      if (res.data.ok) {
        try {
          localStorage.setItem(LOYALTY_KEY, res.data.token);
        } catch {
          /* storage unavailable */
        }
        setToken(res.data.token);
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
          Loyalty card{card.name ? ` · ${card.name}` : ''}
        </p>
        <div className="grid grid-cols-5 gap-2 mb-2">
          {dots.map((filled, i) => (
            <div
              key={i}
              className={`aspect-square rounded-full flex items-center justify-center text-sm ${
                filled ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {filled ? '☕' : i + 1}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600">
          {card.stamps}/{card.target} stamps. Show this to staff to add a stamp.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg bg-white border p-3 space-y-2">
      <p className="text-sm font-semibold text-gray-800">Join our loyalty card</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (optional)"
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone number"
        inputMode="tel"
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
      />
      {message && <p className="text-xs text-amber-700">{message}</p>}
      <button
        type="button"
        onClick={enroll}
        disabled={busy || phone.trim().length < 7}
        className="w-full py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create my card'}
      </button>
    </div>
  );
}

export default function App() {
  const [launch] = useState(() => readLaunchParams());
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(launch?.branchId ?? null);
  const [table, setTable] = useState<string | null>(launch?.table ?? null);

  if (!currentBranchId) {
    return (
      <QRScannerPage
        onBranchDetected={(id, t) => {
          setTable(t);
          setCurrentBranchId(id);
        }}
      />
    );
  }

  return (
    <MenuPage
      branchId={currentBranchId}
      table={table}
      onBack={() => {
        setTable(null);
        setCurrentBranchId(null);
      }}
    />
  );
}
