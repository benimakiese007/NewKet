// Explicit route for /api/analytics/shop-view.
import app from '../../backend/src/server.js';

export default function handler(req, res) {
  return app(req, res);
}

