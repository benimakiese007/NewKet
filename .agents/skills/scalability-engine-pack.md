# Skill Pack: Scalability Engine (NEWKET)

name: scalability-engine
description: Ensure system can scale with users, vendors, and transactions

## Objectif

Maintenir une architecture capable de supporter une croissance forte sans refonte totale.

## Goals

- Support increasing traffic
- Avoid system bottlenecks
- Keep cost efficient
- Ensure modular architecture

## Regles principales de scalabilite

### 1) Architecture modulaire

Chaque fonctionnalite doit etre independante :

- users module
- products module
- orders module
- payments module

Exigence :
- Aucun bloc ne doit dependre fortement d'un autre (couplage faible, interfaces claires).

### 2) API stateless

Chaque requete doit etre independante :

- pas de dependance memoire serveur
- utilisation de tokens (JWT par exemple)
- sessions minimales

Resultat :
- facile a multiplier sur plusieurs serveurs

### 3) Base de donnees optimisee

Regles :

- index sur champs critiques (`user_id`, `product_id`, etc.)
- pagination obligatoire sur toutes les listes
- pas de requetes lourdes sans limite (LIMIT/OFFSET, keyset pagination si besoin)
- eviter N+1 (batch, joins maitrises, endpoints dedies)

### 4) Caching strategique

Tres important pour scaler.

A mettre en cache (selon la feature) :

- produits populaires
- page d'accueil (fragments / sections)
- resultats de recherche (avec invalidation)

### 5) Queue systeme (traitement differe)

Pour eviter la surcharge, les taches non critiques doivent etre asynchrones :

- notifications
- emails
- calculs lourds
- logs

### 6) Lazy computation

Ne pas calculer tant que ce n'est pas necessaire.

Exemple :
- statistiques vendeur calculees en batch (ex: 1 fois par jour), pas en temps reel par defaut

### 7) Horizontal scaling ready

Le systeme doit pouvoir :

- ajouter plusieurs serveurs
- repartir la charge
- fonctionner en cluster

### 8) Limitation intelligente

Protection contre surcharge :

- rate limiting API
- anti-spam commandes
- quotas vendeurs

## Signaux d'alerte

Ton systeme n'est plus scalable si :

- une seule requete ralentit tout
- la base de donnees est trop chargee
- l'API devient lente avec la croissance
- le code devient monolithique

## Application a NEWKET (marketplace)

Points critiques :

- recherche produits
- page d'accueil
- commandes simultanees
- gestion vendeurs

## Vision evolutive

- Phase 1 (debut): simple architecture, peu d'optimisation
- Phase 2 (croissance): cache + pagination, separation modules
- Phase 3 (scale): microservices, queues, multi-serveurs

