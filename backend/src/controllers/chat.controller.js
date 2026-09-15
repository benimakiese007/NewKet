/**
 * chat.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Proxy sécurisé vers l'API Gemini pour le chatbot de support NewKet.
 *
 * Pourquoi ce proxy ?
 *   Appeler Gemini directement depuis le navigateur expose la clé API à quiconque
 *   inspecte le code source. Ce controller centralise l'appel côté serveur : la clé
 *   reste dans les variables d'environnement backend, jamais visible par le client.
 *
 * Sécurité :
 *   - Rate limit chatRateLimit appliqué sur la route (20 req / 15 min par IP)
 *   - Message système (system prompt) géré uniquement côté serveur — le client
 *     ne peut pas le modifier ni l'ignorer.
 *   - Aucune donnée de session n'est persistée : chaque requête est sans état.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Prompt système du chatbot NewKet.
 * Géré ici côté serveur : le frontend ne peut ni le lire ni le modifier.
 */
const SYSTEM_PROMPT = `Tu es l'assistant de support client officiel de NewKet, une marketplace (B2B, B2C, C2C) opérant en RDC.

IMPORTANT : Tu dois toujours te rappeler que NewKet est une PLACE DE MARCHÉ (Marketplace) et non une boutique e-commerce classique. NewKet ne gère ni les stocks, ni les livraisons. Ce sont les vendeurs indépendants qui gèrent eux-mêmes l'expédition et la livraison de leurs propres produits.

CONNAISSANCES SUR NEWKET :
- Paiement et Sécurité : Le paiement est 100% sécurisé via un système de séquestre (FlexPaie). L'argent de l'acheteur est bloqué et remis au vendeur seulement après validation de la livraison (par code OTP) et expiration de la garantie.
- Moyens de paiement : M-Pesa, Airtel Money, Orange Money, Afrimoney, Visa, MasterCard.
- Vendre sur NewKet : Pour devenir vendeur, il faut créer un compte Vendeur et soumettre ses documents d'identité (KYC) pour validation par l'administration.
- Litiges : En cas de non-expédition, remboursement automatique. En cas de problème à la réception, l'acheteur peut ouvrir un litige sur la plateforme.
- Parrainage : Les utilisateurs peuvent gagner des NKTokens (réductions) en invitant des amis qui commandent dans les 30 jours (1 NKToken = 0.50 USD).

RÈGLES DE COMPORTEMENT STRICTES :
1. Ton : Sois toujours professionnel, poli, concis et utilise OBLIGATOIREMENT le vouvoiement ("vous").
2. Suivi de commande/compte : Si l'utilisateur pose une question sur sa commande ou son compte, informe-le que TOUTES les informations détaillées se trouvent sur son Dashboard personnel.
3. Problème de connexion : S'il n'arrive pas à se connecter, conseille l'option "Mot de passe oublié". Si ça ne marche toujours pas, oriente vers l'email : newketmarket@gmail.com.
4. Escalade vers un humain : Si l'utilisateur demande explicitement à parler à un humain/conseiller, ou si tu ne peux pas résoudre son problème complexe, donne-lui l'email (newketmarket@gmail.com) et le téléphone (+243990924254).
5. Hors-sujet : Refuse poliment de répondre à toute question qui ne concerne pas NewKet ou le e-commerce.`;

/**
 * POST /api/chat
 *
 * Body attendu :
 *   { message: string }   — le message de l'utilisateur (max 2 000 caractères)
 *
 * Réponse :
 *   { reply: string }     — la réponse du bot
 */
export const handleChat = async (req, res, next) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        // Si la clé n'est pas configurée, on renvoie un message de fallback
        // plutôt que de planter silencieusement.
        if (!apiKey) {
            console.warn('[Chat] GEMINI_API_KEY non configurée — mode fallback activé.');
            return res.json({
                reply: "Notre assistant est temporairement indisponible. Veuillez nous contacter directement à newketmarket@gmail.com ou au +243990924254."
            });
        }

        const rawMessage = req.body?.message;

        // Validation de la présence et de la longueur du message
        if (typeof rawMessage !== 'string' || !rawMessage.trim()) {
            return res.status(400).json({ error: 'Le message est requis.' });
        }

        const message = rawMessage.trim().slice(0, 2000); // Limite à 2 000 caractères

        const apiUrl = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: SYSTEM_PROMPT }]
                },
                contents: [{
                    role: 'user',
                    parts: [{ text: message }]
                }],
                generationConfig: {
                    maxOutputTokens: 512,   // Limite la longueur des réponses
                    temperature: 0.4        // Réponses cohérentes, peu aléatoires
                }
            })
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text().catch(() => '');
            console.error(`[Chat] Erreur API Gemini ${geminiResponse.status}: ${errorBody}`);
            return res.status(502).json({
                error: 'Le service de chat est temporairement indisponible. Veuillez réessayer.'
            });
        }

        const data = await geminiResponse.json();

        const reply =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer ou nous contacter par email.";

        return res.json({ reply });

    } catch (err) {
        next(err);
    }
};
