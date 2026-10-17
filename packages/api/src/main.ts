import { NestFactory } from '@nestjs/core';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Poster artwork is sent as base64 JSON, so allow up to 10 MB per request.
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Security middleware
  app.use(helmet());

  // nginx on the server is the one proxy in front of the API: use the visitor's IP from X-Forwarded-For,
  // otherwise every visitor shares the proxy's IP and one rate-limit bucket.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 300, // per IP; guests on one café Wi-Fi share an IP
      // Status checks a page repeats every few seconds, and signed-in staff screens, are not counted.
      skip: (req) =>
        (req.method === 'GET' && /^\/(orders|service-requests)\/[0-9a-f-]{36}$/i.test(req.path)) ||
        /^Bearer\s+\S+/.test(req.headers.authorization ?? ''),
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Application listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});
