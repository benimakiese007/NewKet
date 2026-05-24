// Explicit route for /api/health.
// Avoid relying on catch-all routing when using Vite as the Vercel framework.
import app from '../backend/src/server.js';

export default function handler(req, res) {
  return app(req, res);
}

