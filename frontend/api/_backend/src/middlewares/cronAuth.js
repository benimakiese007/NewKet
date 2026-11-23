export function requireCronAuth(req, res, next) {
  const expected =
    process.env.CRON_SECRET ||
    process.env.NEWKET_CRON_SECRET ||
    process.env.INTERNAL_CRON_SECRET;

  if (!expected) {
    return res.status(500).json({
      error: 'Cron auth not configured',
      message: 'Missing CRON_SECRET (or NEWKET_CRON_SECRET / INTERNAL_CRON_SECRET)'
    });
  }

  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const token = typeof req.query.token === 'string' ? req.query.token : null;

  if (bearer === expected || token === expected) return next();

  return res.status(401).json({ error: 'Unauthorized' });
}

