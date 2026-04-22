// ─── Sentry DOIT être initialisé EN PREMIER ───────────────────────────────
import { initSentry, sentryErrorHandler } from './middlewares/sentry.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
initSentry(); // ← Avant tout le reste

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Variables d'environnement déjà chargées en haut (avant initSentry)

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Sécurité et Performance ───────────────────────────────
app.use(helmet()); // Sécurise les headers HTTP
app.use(compression()); // Réduit la taille des réponses

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limite chaque IP à 200 requêtes par fenêtre de 15 minutes
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
  standardHeaders: true, // Retourne le rate limit info dans les `RateLimit-*` headers
  legacyHeaders: false, // Désactive les `X-RateLimit-*` headers
});
app.use('/api', limiter); // Applique le rate limiting sur toutes les API

// ─── Middlewares Globaux ───────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Allow local network IPs dynamically for mobile testing
    if (origin.startsWith('http://192.168.') || origin.startsWith('http://10.') || origin.startsWith('http://172.')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Maintenance & Auth Globale ──────────────────────────────
import { optionalAuth } from './middlewares/auth.js';
import { maintenanceMiddleware } from './middlewares/maintenance.js';

app.use(optionalAuth); // Récupère l'utilisateur si présent
app.use(maintenanceMiddleware); // Bloque les écritures si maintenance ON

// ─── Routes ────────────────────────────────────────────────
// Import des routes
import productRoutes from './routes/product.routes.js';
import orderRoutes from './routes/order.routes.js';
import favoriteRoutes from './routes/favorite.routes.js';
import userRoutes from './routes/user.routes.js';
import promoRoutes from './routes/promo.routes.js';
import activityRoutes from './routes/activity.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import profileRoutes from './routes/profile.routes.js';
import emailRoutes from './routes/emailRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import reviewRoutes from './routes/review.routes.js';
import supportRoutes from './routes/support.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import disputeRoutes from './routes/dispute.routes.js';

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/disputes', disputeRoutes);

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'NewKet Backend API is running 🚀',
    timestamp: new Date().toISOString()
  });
});

// ─── Gestion des erreurs ───────────────────────────────────
// Sentry doit intercepter les erreurs AVANT notre handler custom
app.use(sentryErrorHandler);

// Handler d'erreur maison (après Sentry)
app.use((err, req, res, next) => {
  const eventId = res.sentry; // ID Sentry attaché par sentryErrorHandler
  console.error('❌ Erreur serveur:', err.stack);
  if (eventId) console.error(`   🔍 Sentry Event ID: ${eventId}`);
  
  res.status(err.status || 500).json({ 
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    ...(eventId && { sentryEventId: eventId }) // Retourner l'ID en dev pour faciliter le debug
  });
});

// ─── Démarrage du serveur ──────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Serveur NewKet démarré sur http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
