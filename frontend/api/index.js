// Vercel serverless API entrypoint for deployments rooted at `frontend/`.
// The backend sources must live inside the frontend root at deploy time,
// otherwise Vercel serverless functions fail with ERR_MODULE_NOT_FOUND.
import app from './_backend/src/server.js';

// Vercel Node functions expect a request handler. Express apps are callable,
// but exporting an explicit handler is more reliable across bundlers/runtimes.
export default function handler(req, res) {
  return app(req, res);
}
