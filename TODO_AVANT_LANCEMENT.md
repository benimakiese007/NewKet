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
