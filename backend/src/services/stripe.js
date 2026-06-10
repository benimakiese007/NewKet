import crypto from 'crypto';

export function getStripeConfig() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    checkoutSuccessUrl: process.env.STRIPE_CHECKOUT_SUCCESS_URL || '',
    checkoutCancelUrl: process.env.STRIPE_CHECKOUT_CANCEL_URL || '',
    apiBaseUrl: (process.env.STRIPE_API_BASE_URL || 'https://api.stripe.com').replace(/\/$/, ''),
    currency: String(process.env.STRIPE_CURRENCY || 'usd').toLowerCase(),
  };
}

export function isStripeConfigured() {
  const cfg = getStripeConfig();
  return Boolean(cfg.secretKey);
}

function encodeForm(data) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  return params;
}

export async function createStripeCheckoutSession(payload) {
  const cfg = getStripeConfig();
  if (!cfg.secretKey) throw new Error('STRIPE_SECRET_KEY manquant');

  const form = encodeForm(payload);
  const res = await fetch(`${cfg.apiBaseUrl}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `Stripe HTTP ${res.status}`);
  }

  if (!data?.url) {
    throw new Error('Réponse Stripe invalide: url manquante');
  }

  return {
    raw: data,
    payment_url: data.url,
    request_id: data.id || null,
    status: data.status || null,
    expires_at: null,
  };
}

export function verifyStripeSignature(req) {
  const cfg = getStripeConfig();
  const header = String(req.headers?.['stripe-signature'] || '');
  const raw = req.rawBody;

  if (!cfg.webhookSecret || !header || !raw || !(raw instanceof Buffer)) return false;

  const parts = new Map();
  for (const chunk of header.split(',')) {
    const [key, value] = chunk.split('=', 2).map((part) => part?.trim());
    if (key && value) parts.set(key, value);
  }

  const timestamp = parts.get('t');
  const signatures = header
    .split(',')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith('v1='))
    .map((chunk) => chunk.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  const payload = `${timestamp}.${raw.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', cfg.webhookSecret).update(payload, 'utf8').digest('hex');

  return signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'));
    } catch {
      return false;
    }
  });
}
