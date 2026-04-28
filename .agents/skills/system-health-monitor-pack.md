# Skill Pack: System Health & Action Engine (NEWKET)

name: system-health-monitor
description: Detect issues, inefficiencies and required actions in the app

## Objectif

Superviser l'application comme un systeme vivant :

- detecter automatiquement ce qui ne fonctionne pas
- detecter ce qui peut etre ameliore
- detecter ce qui necessite une action immediate

## Goals

- identify problems early
- suggest actionable improvements
- prioritize tasks automatically

## Ce que le skill doit surveiller

### 1) Performance

Signaux :

- pages lentes (TTFB, temps total, gros assets)
- API lentes (latence, timeouts)
- temps de chargement eleve (images, JS, CSS, fonts)

Actions :

- optimiser / mettre en cache
- dedupe appels API, pagination, lazy loading
- compresser/convertir assets (WebP/AVIF), preconnect, prefetch si utile

### 2) Paiements

Signaux :

- paiement echoue
- paiement sans confirmation (webhook manquant / non traite)
- incoherences (paiement OK mais commande reste en attente)

Actions :

- verifier webhook (reception, signature, retries)
- corriger le statut de commande et/ou paiement
- relancer un traitement (retry) si possible

### 3) Commandes

Signaux :

- commandes bloquees
- commandes non livrees
- delais depasses

Actions :

- notifier vendeur
- escalader le probleme (support/admin)
- corriger l'etat si workflow casse

### 4) Utilisateurs

Signaux :

- abandons de panier / checkout
- baisse d'activite
- comportements anormaux (erreurs repetitives, loops, fraude)

Actions :

- ameliorer UX (frictions, erreurs, clartes)
- relancer utilisateur (notif/email) si le produit le permet
- ajouter garde-fous (rate limit, validation)

### 5) Vendeurs

Signaux :

- vendeurs inactifs
- mauvais taux de livraison
- retours negatifs / disputes

Actions :

- avertir / suspendre si necessaire
- forcer des actions correctives (qualite, delais)
- ajuster regles / outils vendeur

## Systeme de priorites (tres important)

Chaque probleme doit etre classe :

- 🔴 Critique : bloque argent ou commandes (P0)
- 🟠 Important : impact utilisateur direct (P1)
- 🟡 Amelioration : optimisation / qualite / dette technique (P2)

## Rapport attendu (format)

Le skill doit produire un rapport unique, scannable, avec :

1) Resume executif (3-6 lignes)
2) Top 5 problemes par priorite (P0 -> P2)
3) Tableau des incidents (ID, categorie, impact, preuve, action, owner, ETA)
4) Recommandations (quick wins vs refactors)
5) Suivi (regression checks / tests a ajouter)

## Exemple concret (NEWKET)

Cas :

- paiement recu mais commande pas mise a jour

Detection :

- incoherence paiement/commande

Action proposee :

- verifier webhook + corriger statut

Autre cas :

- 70% des utilisateurs quittent au checkout

Action proposee :

- probleme UX paiement (erreurs, lenteur, friction) + instrumentation + quick fix

