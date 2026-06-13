import crypto from 'crypto';

export function getNetikashConfig() {
  return {
    accountsBaseUrl: (process.env.NETIKASH_ACCOUNTS_BASE_URL || 'https://accounts.netikash.com').replace(/\/$/, ''),
    apiBaseUrl: (process.env.NETIKASH_API_BASE_URL || 'https://api.netikash.com/api/v1/trs').replace(/\/$/, ''),
    clientId: process.env.NETIKASH_CLIENT_ID || '',
    clientSecret: process.env.NETIKASH_CLIENT_SECRET || '',
    webhookSigningKey: process.env.NETIKASH_WEBHOOK_SIGNING_KEY || '',
    signatureHeader: (process.env.NETIKASH_SIGNATURE_HEADER || 'x-signature').toLowerCase(),
    timestampHeader: (process.env.NETIKASH_TIMESTAMP_HEADER || 'x-timestamp').toLowerCase(),
    redirectUrl: process.env.NETIKASH_REDIRECT_URL || '',
  };
}

export function isNetikashConfigured() {
  const cfg = getNetikashConfig();
  return Boolean(cfg.clientId && cfg.clientSecret);
}

export async function getNetikashAccessToken() {
  const cfg = getNetikashConfig();
  if (!cfg.clientId) throw new Error('NETIKASH_CLIENT_ID manquant');
  if (!cfg.clientSecret) throw new Error('NETIKASH_CLIENT_SECRET manquant');

  const basicAuth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`, 'utf8').toString('base64');
  const url = `${cfg.accountsBaseUrl}/oauth2/token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Netikash OAuth HTTP ${res.status}`);
  }

  const accessToken = data?.access_token || null;
  if (!accessToken) {
    throw new Error('Réponse Netikash invalide: access_token manquant');
  }

  return accessToken;
}

export function verifyNetikashSignature(req) {
  const cfg = getNetikashConfig();
  const signature = String(req.headers?.[cfg.signatureHeader] || '');
  const signingKey = String(cfg.webhookSigningKey || '');
  let raw = req.rawBody;

  if (!raw && req.body && Object.keys(req.body).length > 0) {
    raw = Buffer.from(JSON.stringify(req.body), 'utf8');
  }

  if (!signingKey || !signature) return false;
  if (!raw || !(raw instanceof Buffer)) return false;

  try {
    const computed = crypto.createHmac('sha256', signingKey).update(raw).digest('base64');
    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, Buffer.alloc(a.length));
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function createNetikashPaymentRequest(payload) {
  const cfg = getNetikashConfig();
  const accessToken = await getNetikashAccessToken();
  const url = `${cfg.apiBaseUrl}/transactions/requests/cli-payments`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Netikash HTTP ${res.status}`);
  }

  if (data?.error === true) {
    throw new Error(data?.message || 'Netikash a rejeté la demande de paiement');
  }

  const paymentUrl = data?.link || data?.data?.link || null;
  if (!paymentUrl) {
    throw new Error('Réponse Netikash invalide: link manquant');
  }

  return {
    raw: data,
    payment_url: paymentUrl,
    request_id: data?.trx || data?.trans || null,
    status: data?.status || null,
    expires_at: data?.expires_at || null,
  };
}
