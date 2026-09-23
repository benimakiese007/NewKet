# À faire avant le lancement en production

## Sécurité & Nettoyage de code
- [ ] **Paiement (Frontend)** : Dans `frontend/src/pages/payment-success.html`, retirer le bloc de code lié au mode simulation `?mock=true` (autour de la ligne 329-334) pour s'assurer que la page vérifie toujours le vrai statut de la transaction via le backend.

