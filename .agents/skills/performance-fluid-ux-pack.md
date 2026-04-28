# Performance & Fluid UX Pack

name: performance-fluid-ux
description: Ensure smooth, fast and responsive UI/UX for web application

## Objectif

Garantir que chaque fonctionnalite livree respecte des standards de fluidite, de vitesse et de reactivite (performance reelle + performance percue).

## Règles (standards)

- Minimiser les appels API (eviter les re-queries inutiles)
- Eviter les re-renders inutiles (isoler, memoization, granularite)
- Lazy loading pour les composants/pages lourds
- Regrouper (batch) les mises a jour d'etat
- Mettre en cache les donnees re-utilisees
- Optimiser les images avant rendu (format, poids, dimensions)

## Règles essentielles de fluidite

### 1) Reduction des rechargements inutiles

- Eviter les appels API repetitifs pour la meme donnee
- Regrouper les requetes quand c'est possible
- Charger 1 fois, reutiliser (cache local / memo / store)

### 2) Lazy loading (chargement intelligent)

Tout ne doit pas charger en meme temps.

Exemples :
- Images produits (chargement a la demande, priorite au viewport)
- Pages secondaires
- Dashboards lourds

### 3) Cache intelligent (critique pour NEWKET)

Stocker temporairement (avec invalidation raisonnable) :
- Produits deja vus
- Profils vendeurs
- Donnees de recherche

Resultat : navigation plus instantanee (moins de latence reseau).

### 4) Optimisation des images

Règles :
- Compression automatique
- Format WebP (ou AVIF si supporte et maitrise)
- Taille adaptee a l'ecran (pas d'images 3000px pour un rendu 300px)

### 5) UX fluide (perception de vitesse)

Meme si ce n'est pas instantane :
- Loaders simples et courts
- Skeleton screens sur les listes/cartes
- Transitions rapides (pas d'animations lourdes)

### 6) Gestion des etats (React ou autre)

Si React :
- Eviter les re-renders globaux
- Isoler les composants
- Memoization (`memo`, `useMemo`, `useCallback`) quand utile (pas par reflexe)

### 7) API design propre

Backend optimise :
- Endpoints clairs (1 intention par endpoint)
- Reponses courtes (ne pas renvoyer l'inutile)
- Pagination obligatoire sur les listes

## Pages critiques marketplace (NEWKET)

- Accueil (chargement produits)
- Recherche
- Page produit
- Checkout

## Version avancee (niveau pro - optionnel)

- CDN images (ex: Cloudflare)
- SSR si pertinent
- Prefetch intelligent
- Streaming UI

## Comment utiliser ce pack

Utilise ce pack avec le workflow `performance-check` pour auditer une page/feature, detecter les lourdeurs, puis appliquer des optimisations concretes.

