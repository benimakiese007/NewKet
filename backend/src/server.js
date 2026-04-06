import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middlewares Globaux ───────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ────────────────────────────────────────────────
// Import des routes
import productRoutes from './routes/product.routes.js';
import orderRoutes from './routes/order.routes.js';
import favoriteRoutes from './routes/favorite.routes.js';
import userRoutes from './routes/user.routes.js';

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/users', userRoutes);

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
