# Documentation du Système de Litiges (Disputes) - NewKet

Ce document décrit en détail le cycle de vie d'un litige sur la plateforme, les différents statuts possibles, les actions des intervenants (Acheteur, Vendeur, Admin) et les automatisations (SLA/Timeouts).

## 1. Ouverture d'un Litige (Acheteur)

Lorsqu'une commande est livrée, les fonds sont placés sous séquestre (Escrow) pour une durée garantie (par défaut 24h, modifiable jusqu'à 7 jours par le vendeur). Pendant cette période, l'acheteur peut ouvrir un litige.

**Conditions :**
- L'acheteur doit fournir entre **2 et 5 photos** du produit.
- L'acheteur peut fournir un **lien vidéo externe** (Drive, YouTube, etc.) pour prouver le problème sans alourdir le stockage.
- Le statut de la commande passe de `DELIVERED` à `DISPUTE_OPEN`.
- Le litige est créé avec le statut `OPEN`.

## 2. Le Cycle de Vie et les Statuts

Un litige navigue entre différents statuts en fonction des interactions :

- **`OPEN` (Ouvert)** : Le litige vient d'être créé par l'acheteur. Le vendeur est notifié et a un délai pour répondre.
- **`SELLER_PENDING` (En attente du Vendeur)** : L'acheteur a envoyé un message ou une preuve supplémentaire, c'est au vendeur de répondre.
- **`BUYER_PENDING` (En attente de l'Acheteur)** : Le vendeur a répondu ou fait une proposition d'arrangement (ex: remboursement partiel). C'est à l'acheteur d'accepter ou de refuser.
- **`UNDER_REVIEW` (En cours d'examen - Escalade)** : Les deux parties n'ont pas trouvé d'accord. Le dossier est transmis à l'administrateur de la plateforme pour un arbitrage final.
- **`RESOLVED` (Résolu)** : Le litige est terminé (fonds remboursés, relâchés, ou accord trouvé).
- **`REJECTED` (Rejeté)** : Le litige a été classé sans suite (souvent par l'admin en cas de plainte abusive).

## 3. Les Automatisations (Cron Jobs / Délais)

Pour éviter que des litiges ne restent bloqués indéfiniment parce qu'une partie fait "le mort", le système intègre des chronomètres invisibles gérés par des tâches de fond (Cron) :

- **Timeout du Vendeur (`seller_response_due_at`)** :
  Si le litige est en statut `OPEN` ou `SELLER_PENDING` et que le temps de réponse du vendeur s'écoule (généralement 48h) sans qu'il ne donne signe de vie :
  👉 **Action automatique :** Le système clôture le litige en faveur de l'acheteur. Il effectue un **Remboursement Total** (`FULL_REFUND`).

- **Timeout de l'Acheteur (`buyer_response_due_at`)** :
  Si le vendeur propose un arrangement financier (ex: garder le produit avec 50% de remboursement) et que le litige passe en `BUYER_PENDING` : l'acheteur a un délai pour refuser. S'il ne répond pas à temps :
  👉 **Action automatique :** Le système considère que qui ne dit mot consent. La **proposition du vendeur est validée automatiquement** et le litige est résolu avec ce montant.

## 4. Modération et Arbitrage (Administrateur)

L'administrateur a le dernier mot et peut intervenir à tout moment, mais son rôle principal commence quand le litige passe en `UNDER_REVIEW`.

**Ce que voit l'Admin :**
- Les détails de la commande.
- Les preuves de l'acheteur (Photos + Liens).
- Les preuves éventuelles du vendeur.
- L'historique complet du chat entre les deux parties.

**Les pouvoirs de l'Admin (Résolution manuelle) :**
Depuis le tableau de bord Admin, 3 choix s'offrent pour clôturer l'incident :
1. **Remboursement Total (`FULL_REFUND`)** : L'acheteur a raison, l'argent de l'escrow lui est rendu.
2. **Remboursement Partiel (`PARTIAL_REFUND`)** : Un compromis est trouvé. Un pourcentage/montant va à l'acheteur, le reste va au vendeur.
3. **Payer le Vendeur (`RELEASE_TO_SELLER`)** : L'acheteur a tort (ou abus), les fonds sous séquestre sont libérés sur le solde du vendeur.

## 5. Résolution à l'Amiable
Si, pendant la discussion, le vendeur propose un remboursement total ou partiel et que l'acheteur clique sur "Accepter", le litige passe directement en `RESOLVED` et les fonds sont dispatchés sans nécessiter d'intervention de l'administrateur.

---
*Fichier généré automatiquement pour tracer la logique métier de la plateforme NewKet.*
