import { initSentry, sentryErrorHandler } from './middlewares/sentry.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
initSentry();

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { optionalAuth } from './middlewares/auth.js';
import { maintenanceMiddleware } from './middlewares/maintenance.js';

import productRoutes from './routes/product.routes.js';
import orderRoutes from './routes/order.routes.js';
import favoriteRoutes from './routes/favorite.routes.js';
import userRoutes from './routes/user.routes.js';
import promoRoutes from './routes/promo.routes.js';
import referralRoutes from './routes/referral.routes.js';
import activityRoutes from './routes/activity.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import pushRoutes from './routes/push.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import profileRoutes from './routes/profile.routes.js';
import emailRoutes from './routes/emailRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import reviewRoutes from './routes/review.routes.js';
import supportRoutes from './routes/support.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import disputeRoutes from './routes/dispute.routes.js';
import cronRoutes from './routes/cron.routes.js';
import systemHealthRoutes from './routes/systemHealth.routes.js';
import manifestRoutes from './routes/manifest.routes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import vendorPayoutRoutes from './routes/vendor-payout.routes.js';
import categoryRoutes from './routes/category.routes.js';
import accountingRoutes from './routes/accounting.routes.js';
import { releaseDueEscrowsJob } from './services/order-workflow.js';
import { processDueDisputesJob } from './controllers/dispute.controller.js';
import { processDuePushNotificationJobsJob } from './services/push-queue.service.js';

const app = express();
const PORT = process.env.PORT || 3000;
const ESCROW_JOB_INTERVAL_MS = 15 * 60 * 1000;
const PUSH_JOB_INTERVAL_MS = 60 * 1000;
const IS_VERCEL = String(process.env.VERCEL || '').toLowerCase() === '1' || Boolean(process.env.VERCEL);

app.disable('x-powered-by');

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

function isAllowedVercelOrigin(origin) {
  if (typeof origin !== 'string' || !origin) return false;

  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'https:') return false;

    return hostname === 'newket.vercel.app'
      || hostname === 'new-ket-benimakiese1234-8436s-projects.vercel.app'
      || hostname === 'new-ket-git-main-benimakiese1234-8436s-projects.vercel.app'
      || hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

const cspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://va.vercel-scripts.com', 'https://www.googletagmanager.com', 'https://www.google-analytics.com', 'https://cdn.jsdelivr.net'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', 'https://unpkg.com', 'https://vitals.vercel-insights.com', 'https://*.ingest.sentry.io', 'https://www.google-analytics.com', 'https://region1.google-analytics.com', 'https://www.googletagmanager.com'],
  mediaSrc: ["'self'", 'blob:', 'https:'],
  workerSrc: ["'self'", 'blob:'],
  frameSrc: ["'self'"],
  manifestSrc: ["'self'"],
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    if (isAllowedVercelOrigin(origin)) {
      return callback(null, true);
    }

    if (origin.startsWith('http://192.168.') || origin.startsWith('http://10.') || origin.startsWith('http://172.')) {
      return callback(null, true);
    }

    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Range'],
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  maxAge: 86400
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: cspDirectives,
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      accelerometer: [],
      camera: [],
      geolocation: [],
      gyroscope: [],
      magnetometer: [],
      microphone: [],
      payment: [],
      usb: []
    }
  }
}));
app.use(compression());
app.use(express.static(path.join(__dirname, '../../frontend/public')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Trop de requetes, veuillez reessayer plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development',
  // Prevent crash when request.ip is undefined (e.g. behind a proxy without trust proxy set)
  keyGenerator: (req) => {
    return req.ip
      || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';
  },
  validate: { xForwardedForHeader: false },
});
app.use('/api', limiter);

app.use(express.json({
  limit: '8mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'NewKet Backend API is running',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res, next) => {
  if (typeof req.url !== 'string') {
    next();
    return;
  }

  const aliasMap = new Map([
    ['/api/admin-behavior-drilldown', '/api/analytics/admin/behavior/drilldown'],
    ['/api/admin-behavior-reset', '/api/analytics/admin/behavior/reset'],
    ['/api/admin-behavior', '/api/analytics/admin/behavior'],
  ]);

  for (const [from, to] of aliasMap.entries()) {
    if (!req.url.startsWith(from)) continue;

    req.url = `${to}${req.url.slice(from.length)}`;
    req.originalUrl = req.url;
    delete req._parsedUrl;
    delete req._query;
    break;
  }

  next();
});

app.use(optionalAuth);
app.use(maintenanceMiddleware);

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/system-health', systemHealthRoutes);
app.use('/api', manifestRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/vendor-payouts', vendorPayoutRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin/accounting', accountingRoutes);

app.use(sentryErrorHandler);

app.use((err, req, res, next) => {
  const eventId = res.sentry;
  console.error('Server error:', err.stack);
  if (eventId) {
    console.error(`Sentry Event ID: ${eventId}`);
  }

  res.status(err.status || 500).json({
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    ...(eventId && { sentryEventId: eventId })
  });
});

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectRun) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Serveur NewKet demarre sur http://127.0.0.1:${PORT}`);
    console.log(`Health check: http://127.0.0.1:${PORT}/api/health`);
  });
}

if (!IS_VERCEL) {
  setTimeout(() => {
    releaseDueEscrowsJob().catch((error) => {
      console.error('[EscrowJob] Startup run failed:', error.message);
    });
  }, 10000);

  setInterval(() => {
    releaseDueEscrowsJob().catch((error) => {
      console.error('[EscrowJob] Scheduled run failed:', error.message);
    });
  }, ESCROW_JOB_INTERVAL_MS);

  setTimeout(() => {
    processDueDisputesJob().catch((error) => {
      console.error('[DisputeJob] Startup run failed:', error.message);
    });
  }, 15000);

  setInterval(() => {
    processDueDisputesJob().catch((error) => {
      console.error('[DisputeJob] Scheduled run failed:', error.message);
    });
  }, 15 * 60 * 1000);

  let _pushJobFnMissing = false;
  setTimeout(() => {
    processDuePushNotificationJobsJob().catch((error) => {
      if (error.message?.includes('Could not find the function')) {
        if (!_pushJobFnMissing) {
          console.warn('[PushJob] claim_push_notification_jobs() not found in DB schema — push jobs disabled until migration is applied.');
          _pushJobFnMissing = true;
        }
        return;
      }
      console.error('[PushJob] Startup run failed:', error.message);
    });
  }, 20000);

  setInterval(() => {
    processDuePushNotificationJobsJob().catch((error) => {
      if (error.message?.includes('Could not find the function')) return; // silenced — one-time warning logged above
      console.error('[PushJob] Scheduled run failed:', error.message);
    });
  }, PUSH_JOB_INTERVAL_MS);
} else {
  console.log('[Jobs] Vercel detected: background intervals disabled. Use /api/cron/* endpoints with Vercel Cron Jobs.');
}

export default app;
