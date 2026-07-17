import app from './_backend/src/server.js';

export default function handler(req, res) {
  const originalUrl = req.url || '/';
  const queryIndex = originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? originalUrl.slice(queryIndex) : '';

  req.url = `/api/analytics/admin/behavior/drilldown${query}`;
  req.originalUrl = req.url;
  delete req._parsedUrl;
  delete req._query;

  return app(req, res);
}
