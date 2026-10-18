import { createSign } from 'crypto';

// Firebase Cloud Messaging (HTTP v1) for the iPhone and Android apps. FCM delivers to iPhones too once the
// APNs key is uploaded in Firebase. Set FCM_SERVICE_ACCOUNT to the service-account JSON (or its base64).
interface Account {
  project_id: string;
  client_email: string;
  private_key: string;
}
let account: Account | null | undefined;
let cached: { token: string; until: number } | null = null;

function readAccount(): Account | null {
  if (account !== undefined) return account ?? null;
  const raw = process.env.FCM_SERVICE_ACCOUNT?.trim();
  try {
    account = raw ? JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')) : null;
  } catch {
    account = null;
  }
  return account ?? null;
}

export const fcmEnabled = () => !!readAccount();

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

async function accessToken(a: Account) {
  if (cached && cached.until > Date.now()) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: a.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(a.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` }),
  });
  if (!res.ok) throw new Error(`FCM auth failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, until: Date.now() + (json.expires_in - 300) * 1000 };
  return cached.token;
}

// 'sent' | 'gone' (token no longer valid: delete it) | 'failed'
export async function fcmSend(token: string, msg: { title: string; body: string; url?: string }): Promise<'sent' | 'gone' | 'failed'> {
  const a = readAccount();
  if (!a) return 'failed';
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await accessToken(a)}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: { url: msg.url ?? '/' },
          android: { priority: 'high', notification: { sound: 'default' } },
          apns: { payload: { aps: { sound: 'default' } } },
        },
      }),
    });
    if (res.ok) return 'sent';
    return res.status === 404 || res.status === 400 ? 'gone' : 'failed';
  } catch {
    return 'failed';
  }
}
