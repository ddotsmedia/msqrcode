import { NestFactory } from '@nestjs/core';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Poster artwork is sent as base64 JSON (up to 10 MB); every other request is small.
  app.use(/^\/admin\/qr-codes\/[^/]+\/artwork$/, express.json({ limit: '10mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ limit: '100kb', extended: true }));

  // Security middleware
  app.use(helmet());

  // nginx on the server is the one proxy in front of the API: use the visitor's IP from X-Forwarded-For,
  // otherwise every visitor shares the proxy's IP and one rate-limit bucket.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Signed-in staff screens poll often and are not counted, but only with a token that really verifies.
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const staff = (h?: string) => {
    const m = /^Bearer\s+(\S+)$/.exec(h ?? '');
    if (!m || !process.env.JWT_SECRET) return false;
    try {
      jwt.verify(m[1]);
      return true;
    } catch {
      return false;
    }
  };

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 300, // per IP; guests on one café Wi-Fi share an IP
      // Status checks a page repeats every few seconds are not counted.
      skip: (req) => (req.method === 'GET' && /^\/(orders|service-requests)\/[0-9a-f-]{36}$/i.test(req.path)) || staff(req.headers.authorization),
    }),
  );
  // Login: 10 failed tries per 15 minutes per IP.
  app.use('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true, message: { message: 'Too many login attempts. Try again in 15 minutes.' } }));
  // Forms anyone can send: a few per IP per day, so one person cannot flood staff inboxes or block real customers.
  const daily = (max: number) =>
    rateLimit({ windowMs: 24 * 3600 * 1000, max, skip: (req) => req.method !== 'POST', message: { message: 'Too many requests from this network today. Please call us instead.' } });
  app.use(['/loyalty/enroll', '/catering', '/careers', '/gift-cards/request', '/corporate/apply'], daily(10));
  app.use(/^\/branches\/[^/]+\/feedback$/, daily(10));

  // Enable CORS
  // The sites call the API on their own domain (/api), so only these origins may call it cross-site.
  const origins = (process.env.CORS_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : process.env.NODE_ENV === 'production' ? ['https://coffeesales.ae', 'https://admin.coffeesales.ae'] : true,
    credentials: false,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Application listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});
