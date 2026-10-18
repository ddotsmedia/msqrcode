import { createSign } from 'crypto';
import { connect } from 'http2';

// Apple Push for the iPhone apps (Capacitor gives an APNs device token on iOS).
// Env: APNS_KEY (the .p8 key text or base64), APNS_KEY_ID, APNS_TEAM_ID; APNS_SANDBOX=1 for development builds.
const BUNDLE: Record<string, string> = { customer: 'ae.coffeesales.app', staff: 'ae.coffeesales.staff' };
let jwt: { token: string; at: number } | null = null;

function key() {
  const raw = process.env.APNS_KEY?.trim();
  if (!raw || !process.env.APNS_KEY_ID || !process.env.APNS_TEAM_ID) return null;
  return raw.includes('BEGIN') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8');
}

export const apnsEnabled = () => !!key();

function token() {
  if (jwt && Date.now() - jwt.at < 40 * 60_000) return jwt.token; // Apple accepts tokens up to an hour old
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'ES256', kid: process.env.APNS_KEY_ID });
  const body = b64({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) });
  const sig = createSign('SHA256').update(`${head}.${body}`).sign({ key: key()!, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  jwt = { token: `${head}.${body}.${sig}`, at: Date.now() };
  return jwt.token;
}

export function apnsSend(device: string, app: string, msg: { title: string; body: string; url?: string }): Promise<'sent' | 'gone' | 'failed'> {
  if (!key()) return Promise.resolve('failed');
  const host = process.env.APNS_SANDBOX === '1' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  return new Promise((resolve) => {
    const client = connect(host);
    client.on('error', () => resolve('failed'));
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${device}`,
      authorization: `bearer ${token()}`,
      'apns-topic': BUNDLE[app] ?? BUNDLE.customer,
      'apns-push-type': 'alert',
      'content-type': 'application/json',
    });
    req.setTimeout(10_000, () => req.close());
    req.on('response', (h) => {
      const status = Number(h[':status']);
      resolve(status === 200 ? 'sent' : status === 410 || status === 400 ? 'gone' : 'failed');
      client.close();
    });
    req.on('error', () => resolve('failed'));
    req.end(JSON.stringify({ aps: { alert: { title: msg.title, body: msg.body }, sound: 'default' }, url: msg.url ?? '/' }));
  });
}
