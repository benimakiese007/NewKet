import crypto from 'crypto';

/**
 * Service pour gérer l'intégration avec FlexPaie
 * Note: Cette implémentation est une structure de base. 
 * Elle devra être adaptée à la documentation officielle de FlexPaie.
 */

export const isFlexpaieConfigured = () => {
    const hasKeys = Boolean(process.env.FLEXPAIE_API_KEY && process.env.FLEXPAIE_SECRET_KEY);
    const isDev = process.env.NODE_ENV !== 'production';
    
    // En développement, si les clés manquent, on active le mode SIMULATION
    return hasKeys || isDev;
};

export const createFlexpaiePaymentRequest = async (payload) => {
    const FLEXPAIE_URL = process.env.FLEXPAIE_BASE_URL || 'https://api.flexpaie.com/v1/payments';
    
    const hasKeys = Boolean(process.env.FLEXPAIE_API_KEY && process.env.FLEXPAIE_SECRET_KEY);
    const isDev = process.env.NODE_ENV !== 'production';

    // ─── MODE SIMULATION (Dev & Pas de clés) ───
    if (!hasKeys && isDev) {
        console.warn('⚠️ MODE SIMULATION PAIEMENT ACTIVÉ : Aucun vrai prélèvement.');
        // On renvoie directement vers la page de succès de l'application
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const mockSuccessUrl = new URL('/src/pages/payment-success.html', baseUrl);
        mockSuccessUrl.searchParams.set('order_id', payload.order_id || 'mock');
        mockSuccessUrl.searchParams.set('transaction_id', payload.ref);
        mockSuccessUrl.searchParams.set('mock', 'true');
        
        return { payment_url: mockSuccessUrl.toString() };
    }

    if (!hasKeys) {
        throw new Error('Intégration FlexPaie incomplète (clés manquantes) en production.');
    }

    // ─── MODE PRODUCTION (Vrai appel API) ───
    const response = await fetch(FLEXPAIE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.FLEXPAIE_SECRET_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Erreur FlexPaie: ${response.statusText}`);
    }

    return await response.json(); // Doit contenir { payment_url: '...' }
};

export const verifyFlexpaieSignature = (req) => {
    try {
        // Support pour flexpay ou flexpaie dans les headers
        const signature = req.headers['x-flexpay-signature'] || req.headers['x-flexpaie-signature'];
        if (!signature) return false;

        const secret = process.env.FLEXPAIE_WEBHOOK_SECRET || process.env.FLEXPAIE_SECRET_KEY;
        if (!secret) {
            console.error('[Sécurité] Il manque FLEXPAIE_WEBHOOK_SECRET dans le .env');
            return false;
        }

        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
        
        // Comparaison sécurisée (évite les attaques temporelles)
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (err) {
        console.error('Erreur de vérification signature FlexPay:', err);
        return false;
    }
};

export const getPaymentByExternalId = async (transactionId) => {
    const FLEXPAIE_URL = process.env.FLEXPAIE_BASE_URL || 'https://api.flexpaie.com/v1/payments';
    const secret = process.env.FLEXPAIE_SECRET_KEY || process.env.FLEXPAIE_API_KEY;
    const isDev = process.env.NODE_ENV !== 'production';

    // ─── MODE SIMULATION (Dev & Pas de clés) ───
    if (!secret && isDev) {
        return { status: 'completed', message: 'MOCK_PAYMENT' };
    }

    if (!secret) {
        throw new Error('[Sécurité] Clé FLEXPAIE_SECRET_KEY manquante.');
    }

    // Le endpoint exact dépend de la documentation de l'agrégateur
    const response = await fetch(`${FLEXPAIE_URL}/${transactionId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`
        }
    });

    if (!response.ok) {
        throw new Error(`Erreur FlexPaie ActiveVerify: ${response.status} ${response.statusText}`);
    }

    return await response.json();
};
