// Vercel serverless API entrypoint for deployments rooted at `frontend/`.
// Delegate all routing to the shared Express app in `backend/src/server.js`.
import app from '../../backend/src/server.js';

export default app;

