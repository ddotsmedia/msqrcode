import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../api';

interface Result {
  ok: boolean;
  title: string;
  body: string | null;
  discount_percent: number | null;
  customer: string;
}

// Counter: redeem a customer's digital offer coupon by scanning its QR or typing the 6-letter code. Each works once.
export default function CouponRedeem({ token, branchId }: { token: string; branchId?: string | null }) {
  const [code, setCode] = useState('');
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function redeem(raw: string) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      setDone(await api<Result>('/admin/coupons/redeem', token, { method: 'POST', body: JSON.stringify({ code: raw, branch_id: branchId || undefined }) }));
      setCode('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-gray-800">Redeem an offer coupon</h3>
      <p className="text-sm text-gray-500">The customer opens the coupon on the website's Offers page. Scan its QR or type the code. Each coupon works once.</p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          redeem(code);
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="ABC234"
          aria-label="Coupon code"
          className="w-32 rounded border border-gray-300 px-3 py-2 font-mono text-lg uppercase tracking-widest"
        />
        <button type="submit" disabled={busy || code.length !== 6} className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Checking…' : 'Redeem'}
        </button>
        <button type="button" onClick={() => setScan((v) => !v)} className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">
          {scan ? 'Close scanner' : 'Scan coupon'}
        </button>
      </form>
      {scan && (
        <Scanner
          onCode={(text) => {
            setScan(false);
            redeem(text);
          }}
        />
      )}
      {done && (
        <p role="status" className="mt-3 rounded bg-green-50 p-3 text-green-800">
          <span className="block text-lg font-bold">✓ Give: {done.title}</span>
          {done.discount_percent ? <span className="block text-sm">{done.discount_percent}% off</span> : null}
          {done.body && <span className="block text-sm">{done.body}</span>}
          <span className="block text-xs text-green-700">Customer: {done.customer}</span>
        </p>
      )}
      {error && <p className="mt-3 rounded bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}

function Scanner({ onCode }: { onCode: (text: string) => void }) {
  const once = useRef(false);
  useEffect(() => {
    const scanner = new Html5QrcodeScanner('coupon-qr-reader', { fps: 10, qrbox: { width: 240, height: 240 } }, false);
    scanner.render(
      (text) => {
        if (once.current) return;
        once.current = true;
        scanner.clear().catch(() => {});
        onCode(text);
      },
      () => {},
    );
    return () => {
      scanner.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div id="coupon-qr-reader" className="mt-3 max-w-sm rounded-xl border p-2" />;
}
