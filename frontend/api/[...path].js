// Catch-all Vercel serverless API entrypoint for deployments rooted at `frontend/`.
// Required so routes like /api/analytics/admin/behavior reach the Express app.
import app from './_backend/src/server.js';

export default function handler(req, res) {
  return app(req, res);
}
