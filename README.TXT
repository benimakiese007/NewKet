========================================================================
    NEWKET - PLATEFORME E-COMMERCE
========================================================================

DESCRIPTION :
Plateforme e-commerce fullstack avec frontend Vite, backend Express
et base de données Supabase.

DEMARRAGE :
1. npm run install:all
2. npm run dev:backend
3. npm run dev:frontend

PAIEMENT :
- L'intégration AvadaPay est prête côté code.
- Il reste à renseigner les clés dans backend/.env :
  AVADAPAY_API_BASE_URL
  AVADAPAY_PUBLIC_KEY
  AVADAPAY_SECRET_KEY
  AVADAPAY_WEBHOOK_SECRET
- Sans ces clés, le bouton de paiement reste bloqué proprement avec
  un message explicite au lieu d'une erreur serveur floue.

ETAT ACTUEL :
- Build frontend OK
- Syntaxe backend OK
- Webhook paiement + idempotence OK
- Payout vendeur automatique encore non activé

========================================================================
