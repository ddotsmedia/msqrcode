import { useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { useLang } from './i18n';

type Kind = 'staff' | 'bill';

// Buttons shown on a menu opened from a table QR: call staff, ask for the bill, order on WhatsApp.
export function TableService({
  branchId,
  branchName,
  table,
  whatsapp,
  picks,
  extra,
}: {
  branchId: string;
  branchName: string;
  table: string;
  whatsapp?: string | null;
  picks: string[];
  extra?: ReactNode;
}) {
  const { t } = useLang();
  const [sent, setSent] = useState<{ kind: Kind; id: string; done: boolean } | null>(null);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check every 10 seconds until a staff member marks the request done.
  useEffect(() => {
    if (!sent || sent.done) return;
    const timer = setInterval(() => {
      axios
        .get(`/api/service-requests/${sent.id}`)
        .then((r) => {
          if (r.data?.status === 'done') setSent((s) => (s ? { ...s, done: true } : s));
        })
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(timer);
  }, [sent]);

  async function send(kind: Kind) {
    setBusy(kind);
    setError(null);
    try {
      const r = await axios.post('/api/service-requests', { branch_id: branchId, table, type: kind });
      if (r.data?.ok) setSent({ kind, id: r.data.id, done: false });
      else setError(r.data?.message ?? t('tableError'));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('tableError'));
    } finally {
      setBusy(null);
    }
  }

  const digits = (whatsapp ?? '').replace(/\D/g, '');
  const text = [`${branchName} · ${t('tableLabel')} ${table}`, picks.length ? `${t('tableOrderIntro')}\n${picks.map((p) => `- ${p}`).join('\n')}` : t('tableOrderIntro')].join('\n');
  const btn = 'flex-1 min-w-0 rounded-xl px-3 py-3 text-sm font-semibold disabled:opacity-60';

  return (
    <div className="fixed inset-x-0 bottom-[72px] md:bottom-4 z-40 px-3">
      <div className="mx-auto max-w-md rounded-2xl border border-brand-100 bg-white p-3 shadow-[0_12px_32px_rgba(10,26,51,0.18)]">
        {extra}
        {sent ? (
          <div role="status" className="flex items-center justify-between gap-3">
            <p className={`text-sm font-semibold ${sent.done ? 'text-green-700' : 'text-brand-800'}`}>
              {sent.done ? t('tableDone') : t(sent.kind === 'bill' ? 'tableBillSent' : 'tableStaffSent').replace('{t}', table)}
            </p>
            <button type="button" onClick={() => setSent(null)} className="shrink-0 text-sm font-semibold text-copper-700">
              {t('tableAgain')}
            </button>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs font-semibold text-slate-500">
              {t('tableLabel')} {table}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => send('staff')} disabled={busy !== null} className={`${btn} bg-brand-700 text-white`}>
                {busy === 'staff' ? '…' : t('tableCallStaff')}
              </button>
              <button type="button" onClick={() => send('bill')} disabled={busy !== null} className={`${btn} border border-brand-100 text-brand-700`}>
                {busy === 'bill' ? '…' : t('tableBill')}
              </button>
              {digits && (
                <a
                  href={`https://wa.me/${digits}?text=${encodeURIComponent(text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${btn} bg-green-600 text-center text-white`}
                >
                  {t('tableWhatsapp')}
                </a>
              )}
            </div>
            {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
