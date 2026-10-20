// Reports one QR scan to the API (anonymous). Never blocks the page.
import axios from 'axios';

export type ScanBody = { kind: 'table' | 'branch' | 'feedback' | 'promo' | 'stamp'; branch_id?: string; table?: string; promotion_id?: string };

export function logScan(body: ScanBody) {
  axios.post('/api/qr/scans', body).catch(() => undefined);
}
