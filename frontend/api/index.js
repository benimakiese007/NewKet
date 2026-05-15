// Vercel serverless API entrypoint for deployments rooted at `frontend/`.
// The backend sources must live inside the frontend root at deploy time,
// otherwise Vercel serverless functions fail with ERR_MODULE_NOT_FOUND.
import app from './_backend/src/server.js';

export default app;
