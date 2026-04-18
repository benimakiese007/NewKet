========================================================================
    NEWKET - PLATEFORME E-COMMERCE MODERNE
========================================================================

DESCRIPTION :
Plateforme e-commerce fullstack avec architecture monorepo, 
utilisant Supabase pour la base de données et l'authentification.

STRUCTURE DU PROJET :
- /frontend : Application web (Vite + Vanilla JS/Tailwind)
- /backend  : API Node.js (Express)
- /database : Schema et migrations Supabase
- /docs     : Documentation supplémentaire

INSTALLATION ET DEMARRAGE :
1. Installer les dependances :
   npm run install:all

2. Lancer le backend (Port 3001) :
   npm run dev:backend

3. Lancer le frontend (Port 5173) :
   npm run dev:frontend

TECHNOLOGIES CLES :
- Frontend : Vite, Vanilla CSS/Tailwind, Service Workers (PWA)
- Backend  : Node.js, Express, Nodemailer
- DB/Auth  : Supabase (PostgreSQL)
- Paiement : Intégration Flutterwave
- Monitoring : Sentry Integration

NOTES DE VERSION :
- La plateforme est actuellement en phase de stabilisation de production.
- Toute mention de "WhatsApp" a ete retiree au profit de flux de paiement automatiques.
- Deploiement automatique via Vercel configurer sur la branche main.

========================================================================
    (c) 2026 - NewKet Project
========================================================================
