import { BadRequestException } from '@nestjs/common';
import * as webpush from 'web-push';
import { PushService } from './push.service';

jest.mock('web-push', () => ({
  generateVAPIDKeys: jest.fn(() => ({ publicKey: 'PUB', privateKey: 'PRIV' })),
  sendNotification: jest.fn(async () => ({})),
}));

function setup() {
  const secrets = new Map<string, string>();
  const subs: any[] = [];
  const subsRepo = {
    findOne: jest.fn(async ({ where }: any) => subs.find((s) => s.endpoint === where.endpoint) ?? null),
    find: jest.fn(async () => subs),
    save: jest.fn(async (x: any) => {
      const i = subs.findIndex((s) => s.endpoint === x.endpoint);
      if (i >= 0) subs[i] = x;
      else subs.push({ id: `s${subs.length}`, ...x });
      return x;
    }),
    delete: jest.fn(async (w: any) => {
      const i = subs.findIndex((s) => (w.id ? s.id === w.id : s.endpoint === w.endpoint));
      if (i >= 0) subs.splice(i, 1);
    }),
    count: jest.fn(async () => subs.length),
  };
  const secretRepo = {
    findOne: jest.fn(async ({ where }: any) => (secrets.has(where.key) ? { value: secrets.get(where.key) } : null)),
    save: jest.fn(async ({ key, value }: any) => secrets.set(key, value)),
  };
  const cards = { findOne: jest.fn(async ({ where }: any) => (where.token === 'tok' ? { id: 'c1' } : null)) };
  return { svc: new PushService(subsRepo as any, secretRepo as any, cards as any), subs, secrets };
}

const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } };

describe('PushService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates the signing keys once and keeps them', async () => {
    const { svc, secrets } = setup();
    expect(await svc.publicKey()).toEqual({ key: 'PUB' });
    await svc.publicKey();
    expect(webpush.generateVAPIDKeys).toHaveBeenCalledTimes(1);
    expect(JSON.parse(secrets.get('vapid')!)).toEqual({ publicKey: 'PUB', privateKey: 'PRIV' });
  });

  it('saves a subscription for a card and replaces it on re-subscribe', async () => {
    const { svc, subs } = setup();
    await svc.subscribe({ token: 'tok', subscription: sub });
    await svc.subscribe({ token: 'tok', subscription: sub });
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ card_id: 'c1', endpoint: sub.endpoint });
  });

  it('rejects bad subscriptions', async () => {
    const { svc } = setup();
    await expect(svc.subscribe({ token: 'tok', subscription: { ...sub, endpoint: 'http://x' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.subscribe({ token: '', subscription: sub })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('drops subscriptions the browser says are gone', async () => {
    const { svc, subs } = setup();
    await svc.subscribe({ token: 'tok', subscription: sub });
    (webpush.sendNotification as jest.Mock).mockRejectedValueOnce({ statusCode: 410 });
    await svc.sendToCard('c1', { title: 't', body: 'b' });
    expect(subs).toHaveLength(0);
  });

  it('allows one broadcast an hour', async () => {
    const { svc } = setup();
    await svc.subscribe({ token: 'tok', subscription: sub });
    expect(await svc.broadcast({ title: 'Hello', body: 'New pastries today' })).toEqual({ ok: true, sent: 1 });
    expect((await svc.broadcast({ title: 'Again', body: 'Too soon' })).ok).toBe(false);
  });
});
