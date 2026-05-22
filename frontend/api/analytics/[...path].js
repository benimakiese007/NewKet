// Catch-all for /api/analytics/*.
//
// Vercel routing resolves into the `analytics/` directory first, so the root
// catch-all `api/[...path].js` is NOT used for paths like:
//   /api/analytics/admin/behavior
// This file ensures all analytics routes reach the Express app in production.
import app from '../_backend/src/server.js';

export default function handler(req, res) {
  return app(req, res);
}

