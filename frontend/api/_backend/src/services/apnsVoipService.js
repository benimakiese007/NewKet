import http2 from 'http2';
import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';

// ─────────────────────────────────────────────────────────────────────────────
// ApnsVoipService
// Apple Push Notification service (APNs) VoIP Push via HTTP/2
// Uses native Node.js http2 + crypto — zero external dependencies.
//
// Triggered by push.controller.js -> sendCallRing
// Wakes iOS devices from deep sleep & triggers native CallKit UI.
// ─────────────────────────────────────────────────────────────────────────────

const APNS_KEY_ID = process.env.APNS_KEY_ID;
const APNS_TEAM_ID = process.env.APNS_TEAM_ID;
const APNS_TOPIC = process.env.APNS_TOPIC || 'cd.newket.app.voip';
const APNS_IS_PRODUCTION = process.env.APNS_ENV === 'production' || process.env.NODE_ENV === 'production';
const APNS_HOST = APNS_IS_PRODUCTION
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';

// Cache the JWT token (valid for 1 hour, refreshed every 50 mins)
let cachedJwt = null;
let jwtGeneratedAt = 0;

function _getPrivateKey() {
    if (process.env.APNS_KEY_BASE64) {
        return Buffer.from(process.env.APNS_KEY_BASE64, 'base64').toString('utf8');
    }
    if (process.env.APNS_KEY) {
        return process.env.APNS_KEY;
    }
    return null;
}

function _generateJwt() {
    const now = Math.floor(Date.now() / 1000);
    // Reuse token for 50 minutes (Apple allows up to 60m)
    if (cachedJwt && now - jwtGeneratedAt < 3000) {
        return cachedJwt;
    }

    const privateKey = _getPrivateKey();
    if (!privateKey || !APNS_KEY_ID || !APNS_TEAM_ID) {
        return null;
    }

    const header = {
        alg: 'ES256',
        kid: APNS_KEY_ID,
    };
    const payload = {
        iss: APNS_TEAM_ID,
        iat: now,
    };

    const base64Url = (obj) =>
        Buffer.from(JSON.stringify(obj))
            .toString('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');

    const unsignedToken = `${base64Url(header)}.${base64Url(payload)}`;
    const signer = crypto.createSign('sha256');
    signer.update(unsignedToken);
    signer.end();

    const signature = signer
        .sign(privateKey)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    cachedJwt = `${unsignedToken}.${signature}`;
    jwtGeneratedAt = now;
    return cachedJwt;
}

async function _getVoipTokensForUser(userId) {
    if (!userId) return [];
    try {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('apns_voip_token')
            .eq('id', userId)
            .not('apns_voip_token', 'is', null);

        if (error || !data) return [];
        return data.map((r) => r.apns_voip_token).filter(Boolean);
    } catch {
        return [];
    }
}

async function _revokeToken(token) {
    if (!token) return;
    try {
        await supabaseAdmin
            .from('users')
            .update({ apns_voip_token: null })
            .eq('apns_voip_token', token);
        console.log('[APNs VoIP] Token invalide ou expiré révoqué de la base.');
    } catch (e) {
        console.warn('[APNs VoIP] Erreur révocation token:', e.message);
    }
}

function _sendHttp2VoipPush(token, payloadJson, jwt) {
    return new Promise((resolve) => {
        const client = http2.connect(APNS_HOST);

        client.on('error', (err) => {
            console.error('[APNs VoIP] Erreur connexion HTTP/2:', err.message);
            resolve({ success: false, error: err.message });
        });

        const req = client.request({
            ':method': 'POST',
            ':path': `/3/device/${token}`,
            'authorization': `bearer ${jwt}`,
            'apns-topic': APNS_TOPIC,
            'apns-push-type': 'voip',
            'apns-priority': '10',
            'apns-expiration': '0',
            'content-type': 'application/json',
        });

        let data = '';
        req.on('response', (headers) => {
            const status = headers[':status'];
            req.on('data', (chunk) => {
                data += chunk;
            });
            req.on('end', () => {
                client.close();
                if (status === 200) {
                    resolve({ success: true });
                } else {
                    console.warn(`[APNs VoIP] Erreur status ${status}: ${data}`);
                    if (status === 410) {
                        // Token is unregistered / expired
                        _revokeToken(token);
                    }
                    resolve({ success: false, status, response: data });
                }
            });
        });

        req.on('error', (err) => {
            console.error('[APNs VoIP] Erreur requête:', err.message);
            client.close();
            resolve({ success: false, error: err.message });
        });

        req.write(payloadJson);
        req.end();
    });
}

const ApnsVoipService = {
    isConfigured() {
        return Boolean(APNS_KEY_ID && APNS_TEAM_ID && _getPrivateKey());
    },

    /**
     * Envoie un push VoIP Apple aux appareils iOS d'un utilisateur
     * pour réveiller l'écran et afficher CallKit.
     *
     * @param {string} userId - UUID de l'utilisateur destinataire
     * @param {object} opts
     * @param {string} opts.orderId - ID de la commande
     * @param {string} opts.callerName - Nom de l'appelant
     * @param {string} [opts.callerAvatar] - Avatar
     * @returns {Promise<{ sent: number }>}
     */
    async sendCallRing(userId, { orderId, callerName, callerAvatar }) {
        if (!this.isConfigured()) {
            return { sent: 0, reason: 'not_configured' };
        }

        const tokens = await _getVoipTokensForUser(userId);
        if (tokens.length === 0) {
            return { sent: 0, reason: 'no_tokens' };
        }

        const jwt = _generateJwt();
        if (!jwt) {
            console.warn('[APNs VoIP] Impossible de générer le JWT');
            return { sent: 0, reason: 'jwt_generation_failed' };
        }

        const payload = JSON.stringify({
            aps: {
                alert: {
                    title: `Appel de ${callerName || 'NewKet'}`,
                    body: 'Appel entrant sur votre commande',
                },
                sound: 'default',
            },
            type: 'incoming-call',
            order_id: orderId || '',
            caller_name: callerName || 'NewKet',
            caller_avatar: callerAvatar || '',
        });

        const results = await Promise.all(
            tokens.map((token) => _sendHttp2VoipPush(token, payload, jwt))
        );
        const sent = results.filter((r) => r.success).length;
        console.log(`[APNs VoIP] ${sent}/${tokens.length} push(s) VoIP envoyé(s) à user: ${userId}`);
        return { sent };
    },
};

export default ApnsVoipService;
