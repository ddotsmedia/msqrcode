// Reports one QR scan to the API (anonymous). Never blocks the screen.
import { API } from './api';

export type ScanBody = { kind: 'table' | 'branch' | 'feedback' | 'promo' | 'stamp'; branch_id?: string; table?: string; promotion_id?: string };

export function logScan(body: ScanBody) {
  fetch(`${API}/qr/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}
