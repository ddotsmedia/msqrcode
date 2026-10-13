import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
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
                {product.dietary_tags.map((tag) => (
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
            <p className="text-3xl font-bold text-brand-600">{product.base_price.toFixed(2)} AED</p>
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

  useEffect(() => {
    const loadMenuData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load branch details
        const branchRes = await axios.get(`${API_BASE_URL}/branches/${branchId}`);
        setBranch(branchRes.data);

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
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              ← Change Branch
            </button>
          </div>

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
                        {product.base_price.toFixed(2)} AED
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
