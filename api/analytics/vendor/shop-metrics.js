// Explicit route for /api/analytics/vendor/shop-metrics.
import app from '../../../backend/src/server.js';

export default function handler(req, res) {
  return app(req, res);
}

