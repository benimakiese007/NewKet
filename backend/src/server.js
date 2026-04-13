import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middlewares Globaux ───────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'NewKet Backend API is running 🚀',
    timestamp: new Date().toISOString()
  });
});

// ─── Gestion des erreurs ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err.stack);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ─── Démarrage du serveur ──────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Serveur NewKet démarré sur http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
