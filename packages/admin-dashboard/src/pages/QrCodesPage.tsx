import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api';

interface Branch {
  id: string;
  code: string;
  name: string;
  address: string | null;
  status: string;
}

interface QrItem {
  branch: Branch;
  payload: string;
  dataUrl: string;
}

// The menu scanner reads this exact format: branch:<uuid>
export function qrPayload(branchId: string): string {
  return `branch:${branchId}`;
}

function printSheet(item: QrItem): void {
  const w = window.open('', '_blank', 'width=600,height=700');
  if (!w) return;
  const name = item.branch.name.replace(/</g, '&lt;');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${name} QR</title>
<style>
  body{font-family:system-ui,sans-serif;text-align:center;padding:48px;color:#111}
  img{width:320px;height:320px}
  h1{font-size:28px;margin:16px 0 4px}
  p{color:#555;margin:0 0 4px}
  small{color:#888;font-size:12px}
</style></head><body>
<h1>Milestones Coffee</h1>
<p>${name}</p>
<img src="${item.dataUrl}" alt="QR code">
<p>Scan to view the menu</p>
<small>${item.payload}</small>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
  w.document.close();
}

export default function QrCodesPage({ token }: { token: string }) {
  const [items, setItems] = useState<QrItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<Branch[]>('/branches', token)
      .then(async (branches) => {
        const built = await Promise.all(
          branches.map(async (branch) => {
            const payload = qrPayload(branch.id);
            const dataUrl = await QRCode.toDataURL(payload, {
              width: 512,
              margin: 2,
              errorCorrectionLevel: 'M',
            });
            return { branch, payload, dataUrl };
          }),
        );
        if (!cancelled) setItems(built);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">QR codes</h2>
        <p className="text-sm text-gray-500">
          Print a branch's QR code and place it on the table or counter. Customers scan it to open that branch's menu.
        </p>
      </div>

      {error && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</p>}
      {loading && <p className="text-gray-500 text-sm">Generating codes…</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <article key={item.branch.id} className="bg-white rounded-xl shadow-sm border p-4 flex flex-col items-center text-center">
            <img src={item.dataUrl} alt={`QR code for ${item.branch.name}`} className="w-48 h-48" />
            <h3 className="mt-3 font-semibold text-gray-800">{item.branch.name}</h3>
            <p className="text-xs text-gray-500">{item.branch.code}</p>
            <p className="text-[11px] text-gray-400 break-all mt-1">{item.payload}</p>
            <div className="mt-4 flex gap-2 w-full">
              <a
                href={item.dataUrl}
                download={`qr-${item.branch.code}.png`}
                className="flex-1 border border-gray-300 rounded py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Download PNG
              </a>
              <button
                type="button"
                onClick={() => printSheet(item)}
                className="flex-1 bg-brand-600 text-white rounded py-2 text-sm font-semibold"
              >
                Print
              </button>
            </div>
          </article>
        ))}
      </div>

      {!loading && items.length === 0 && !error && (
        <p className="text-gray-500 text-sm">No branches yet.</p>
      )}
    </section>
  );
}
