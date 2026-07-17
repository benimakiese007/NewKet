// Stable Vercel serverless API entrypoint for deployments rooted at `frontend/`.
// We intentionally avoid `[...path].js` file-system routing here because some Vercel
// configurations/framework presets may not pick up bracket-based routes reliably.
// Instead, `frontend/vercel.json` rewrites every `/api/*` request to this handler
// and passes the original suffix through the `path` query param.
import app from './_backend/src/server.js';

export default function handler(req, res) {
  const raw = req?.query?.path ?? '';
  const suffix = Array.isArray(raw) ? raw.join('/') : String(raw || '');

  // Preserve query string for Express routes that rely on it.
  const originalUrl = req.url || '/';
  const queryIndex = originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? originalUrl.slice(queryIndex) : '';

  // Express expects to receive `/api/...` paths as configured in `_backend/src/server.js`.
  // Guard: if someone hits `/api/app` directly, treat it as `/api` (root) instead of `/api/app`.
  const effectiveSuffix = suffix === 'app' ? '' : suffix;
  req.url = (`/api/${effectiveSuffix}`).replace(/\/+$/, '') + query;

  return app(req, res);
}
