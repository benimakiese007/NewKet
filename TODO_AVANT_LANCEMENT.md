# À faire avant le lancement en production

## Sécurité & Nettoyage de code
- [ ] **Paiement (Frontend)** : Dans `frontend/src/pages/payment-success.html`, retirer le bloc de code lié au mode simulation `?mock=true` (autour de la ligne 329-334) pour s'assurer que la page vérifie toujours le vrai statut de la transaction via le backend.


## Lors de l'achat du nom de domaine officiel (newket.market)
Quand le nom de domaine sera acheté (prévu dans ~4 mois), suivre ces étapes pour ne pas perdre le SEO :

- [ ] **1. Vercel** : Ajouter 
ewket.market dans *Settings > Domains* et configurer les DNS chez le registraire (Hostinger, LWS, etc.).
- [ ] **2. Sitemap** : Dans le code source (rontend/public/sitemap.xml), remplacer toutes les occurrences de https://newket.vercel.app par https://newket.market.
- [ ] **3. Prerender.io** : Sur le dashboard Prerender, supprimer l'ancien sitemap et importer le nouveau : https://newket.market/sitemap.xml.
- [ ] **4. Google Search Console** : Créer un compte, déclarer la propriété https://newket.market et soumettre le nouveau sitemap pour forcer Google à indexer la nouvelle adresse.

## Transfert de propriété et Comptes de services (Séparation Perso / Pro)
Avant le lancement final, migrer tous les services tiers du compte personnel ("benimakiese007") vers un compte/organisation dédié à l'entreprise (ex: un email officiel comme dmin@newket.market).

- [ ] **Supabase (Base de données)** : Transférer le projet vers une organisation Supabase "NewKet". Attention : si une nouvelle base est créée, il faudra impérativement mettre à jour les variables VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY et la SERVICE_ROLE_KEY sur Vercel.
- [ ] **GitHub** : Transférer le dépôt (repository) vers une nouvelle organisation GitHub (ex: NewKet-Market/NewKet). Note : il faudra ensuite re-lier Vercel à ce nouveau dépôt pour que les déploiements automatiques continuent de fonctionner.
- [ ] **Sentry (Suivi des erreurs)** : Transférer le projet Sentry sur un compte Pro ou l'assigner à l'adresse email de l'entreprise. Mettre à jour le DSN dans le code (fichier .env et Vercel) si le lien change.
- [ ] **Vercel (Hébergement)** : S'assurer que le projet Vercel est bien hébergé sur le compte de l'entreprise (ou créer une Vercel Team).
- [ ] **Autres services (Prerender.io, Cloudinary, Analytics, etc.)** : Mettre à jour l'email de facturation et de connexion pour tous les autres services utilisés par l'application pour centraliser les accès.
