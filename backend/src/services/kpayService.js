import axios from 'axios';
import crypto from 'crypto';

class KPayService {
  constructor() {
    this.baseURL = 'https://kpay.site';
    this.apiKey = process.env.KPAY_PUBLIC_KEY;
    this.secretKey = process.env.KPAY_SECRET_KEY;
    
    if (!this.apiKey || !this.secretKey) {
      console.warn('⚠️ K-PAY API keys are missing from environment variables.');
    }

    // Configurer l'instance Axios avec les en-têtes requis par la documentation K-PAY
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 8000, // Timeout de 8 secondes pour éviter les 504 Gateway Timeout sur Vercel
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Secret-Key': this.secretKey,
      },
    });
  }

  /**
   * Initialise un paiement en mode GATEWAY (Passerelle hébergée).
   * @param {number} amount - Le montant à payer
   * @param {string} externalId - L'ID de la commande dans NewKet (ex: ORDER-123)
   * @param {string} returnUrl - L'URL où K-PAY va rediriger le client après le paiement (succès ou échec)
   * @param {string} cancelUrl - L'URL où K-PAY va rediriger le client s'il annule
   * @returns {Promise<Object>} La réponse de K-PAY (contenant le gatewayUrl)
   */
  async createPayment(amount, externalId, returnUrl, cancelUrl, currency = 'CDF') {
    try {
      const payload = {
        amount: amount,
        currency: currency,
        externalId: externalId,
        returnUrl: returnUrl,
        cancelUrl: cancelUrl
      };

      // Appel de l'endpoint d'initialisation en mode GATEWAY
      const response = await this.client.post('/api/v1/payments/init', payload);
      
      // Retourne l'objet contenant "gatewayUrl"
      return response.data;
    } catch (error) {
      // Gestion de l'enveloppe d'erreur K-PAY
      if (error.response && error.response.data) {
        console.error('Erreur K-PAY API:', error.response.data);
        throw new Error(error.response.data.message || 'Erreur lors du paiement K-PAY');
      }
      throw error;
    }
  }
  /**
   * Vérifie la signature cryptographique envoyée par K-PAY lors de la redirection de retour
   * @param {Object} query - L'objet req.query d'Express contenant status, reference, externalId, ts, sig
   * @returns {boolean} true si la signature est valide
   */
  verifyReturnSignature(query) {
    const { status, reference, externalId = "", ts, sig } = query;
    
    // Le secret webhook de K-PAY
    const gatewaySecret = process.env.KPAY_WEBHOOK_SECRET;

    if (!sig || !ts || !gatewaySecret) return false;

    const stringToSign = `${status}${reference}${externalId}${ts}`;
    
    const expected = crypto
      .createHmac("sha256", gatewaySecret)
      .update(stringToSign)
      .digest("hex");

    const ok = sig.length === expected.length && 
               crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    
    // Vérifie aussi que le timestamp a moins de 10 minutes (prévention anti-replay)
    return ok && (Date.now() - Number(ts) < 10 * 60 * 1000);
  }

  /**
   * Effectue un transfert sortant (Retrait) vers un compte Mobile Money via l'API K-PAY
   * @param {number} amount - Le montant (dans la devise du provider)
   * @param {string} currency - La devise (ex: USD, CDF)
   * @param {string} provider - Le code de l'opérateur (ex: VODACOM_MPESA_COD)
   * @param {string} phoneNumber - Le numéro de téléphone du bénéficiaire
   * @param {string} externalId - Un identifiant unique (idempotence)
   * @param {string} description - Description du transfert
   * @returns {Promise<Object>} La réponse KPay avec l'objet Withdrawal
   */
  async withdrawToVendor(amount, currency, provider, phoneNumber, externalId, description = "Payout Vendeur NewKet") {
    try {
      const payload = {
        amount: amount,
        currency: currency,
        provider: provider,
        phoneNumber: phoneNumber,
        externalId: externalId,
        description: description
      };

      const response = await this.client.post('/api/v1/payments/withdraw', payload);
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        console.error('Erreur K-PAY Withdraw API:', error.response.data);
        throw new Error(error.response.data.message || 'Erreur lors du transfert K-PAY');
      }
      throw error;
    }
  }
}

export const isKpayConfigured = () => {
  return !!(process.env.KPAY_PUBLIC_KEY && process.env.KPAY_SECRET_KEY);
};

export default new KPayService();
