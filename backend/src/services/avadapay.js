import crypto from 'crypto';

export function getAvadaPayConfig() {
  return {
    apiBaseUrl: process.env.AVADAPAY_API_BASE_URL || '',
    publicKey: process.env.AVADAPAY_PUBLIC_KEY || '',
    secretKey: process.env.AVADAPAY_SECRET_KEY || '',
    webhookSecret: process.env.AVADAPAY_WEBHOOK_SECRET || '',
    signatureHeader: (process.env.AVADAPAY_SIGNATURE_HEADER || 'x-avadapay-signature').toLowerCase(),
    redirectUrl: process.env.AVADAPAY_REDIRECT_URL || '',
  };
}

export function isAvadaPayConfigured() {
  const cfg = getAvadaPayConfig();
  return Boolean(cfg.apiBaseUrl && cfg.secretKey);
}

export function verifyAvadaPaySignature(req) {
  const cfg = getAvadaPayConfig();
  const headerName = cfg.signatureHeader;
  const incoming = String(req.headers?.[headerName] || '');
  const secret = String(cfg.webhookSecret || '');

  if (!secret || !incoming) return false;
  const raw = req.rawBody;
  if (!raw || !(raw instanceof Buffer)) return false;

  try {
    const computed = crypto.createHmac('sha256', secret).update(raw).digest('hex');

    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(incoming, 'utf8');
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, Buffer.alloc(a.length));
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Minimal scaffolding: endpoint shape is left configurable because AvadaPay endpoints can differ by account/product.
export async function createAvadaPayCheckoutLink(payload) {
  const cfg = getAvadaPayConfig();
  if (!cfg.apiBaseUrl) throw new Error('AVADAPAY_API_BASE_URL manquant');
  if (!cfg.secretKey) throw new Error('AVADAPAY_SECRET_KEY manquant');

  // By default, try a common REST pattern. If AvadaPay uses a different path, change it via AVADAPAY_API_BASE_URL
  // (e.g. pointing directly to the correct base + path) or update this function when you have the docs.
  const url = cfg.apiBaseUrl.replace(/\/$/, '') + '/payments';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `AvadaPay HTTP ${res.status}`);
  }

  // Support a couple of common response shapes.
  const paymentUrl = data?.data?.link || data?.data?.payment_url || data?.payment_url || data?.link || null;
  if (!paymentUrl) {
    throw new Error('Réponse AvadaPay invalide: payment_url manquant');
  }

  return {
    raw: data,
    payment_url: paymentUrl,
  };
}

