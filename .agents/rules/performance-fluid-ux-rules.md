# Performance & Fluid UX Rules

Ces regles s'appliquent a toute feature livree : l'objectif est d'eviter les degradations de fluidite.

## Interdits (casse la fluidite)

- Recharger toute la page pour un petit changement
- Charger toutes les donnees d'un coup (pas de pagination)
- Images non compressees / dimensions non adaptees
- Trop de requetes API en parallele sans besoin
- Composants non optimises (re-renders en cascade)

## Obligations

- Dedupliquer les requetes et mettre en cache les donnees frequentes
- Regrouper les appels quand c'est possible (batching)
- Lazy loading pour pages secondaires et parties lourdes
- Pagination obligatoire sur les listes
- Toujours optimiser les images avant rendu (WebP, compression, tailles)

## NEWKET - zones critiques a proteger

- Accueil (listes produits)
- Recherche
- Page produit
- Checkout

