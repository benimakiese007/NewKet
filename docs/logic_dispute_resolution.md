# Architecture : Gestion des Litiges (Disputes)

## 1. Objectif du Système
Dans une transaction avec paiement séquestré (Escrow), l'acheteur doit être protégé contre la non-livraison ou la non-conformité, tandis que le vendeur doit être protégé contre les acheteurs de mauvaise foi.
Le système de litige de NewKet est conçu selon une approche de **médiation en deux phases** :
1. Négociation à l'amiable (Peer-to-Peer).
2. Escalade et arbitrage (Administrateur).

## 2. Phase 1 : La Négociation à l'Amiable
Le processus commence lorsqu'un acteur (généralement l'acheteur) clique sur "Signaler un problème".

### Déclenchement (`DISPUTE_OPEN`)
- L'état de la commande passe en `DISPUTE_OPEN`.
- Les fonds restent gelés (`escrow_status: HELD`) et la libération automatique est annulée.
- Une messagerie privée (Chat de litige) est créée spécifiquement pour cette commande entre l'Acheteur, le Vendeur, et l'Admin.

### Résolution par les pairs (Endpoints : `vendorRespondToDispute`, `buyerRespondToDispute`)
- Le système encourage les deux parties à s'entendre.
- Le vendeur peut utiliser l'interface pour faire des propositions (ex: proposer un remboursement partiel ou total de X francs).
- Si l'acheteur clique sur "Accepter l'offre", le système exécute **automatiquement** la résolution : l'argent est partagé selon l'accord, et le litige est clos. L'admin n'a pas besoin d'intervenir.

## 3. Phase 2 : L'Escalade à l'Administrateur
Si la communication est rompue ou si les exigences sont irréconciliables, **l'une ou l'autre des parties** (Vendeur ou Acheteur) peut cliquer sur "Escalader à l'Administrateur" (Endpoint : `escalateToAdmin`).

### Actions du Système lors de l'escalade :
- Le litige passe en statut `UNDER_REVIEW`.
- Les boutons d'accord amiable sont désactivés pour les deux parties.
- Une alerte/email est envoyée à l'équipe d'administration de NewKet.

### L'Arbitrage par l'Admin (Endpoints : `resolveDispute`, `rejectDispute`)
L'Administrateur se connecte sur son espace privé (`/admin/disputes.html`).
Il a accès à l'intégralité de la conversation (Chat) et aux preuves fournies (photos, textes).
L'Admin dispose du pouvoir absolu de trancher via deux actions principales :

#### A. Résoudre en faveur de l'Acheteur (`resolveDispute`)
L'Admin décide qu'il y a eu un manquement côté vendeur.
- L'Admin peut définir un montant de remboursement exact (partiel ou total).
- L'argent est renvoyé à l'acheteur. S'il reste une fraction (remboursement partiel), elle est libérée pour le vendeur.
- Le litige est clos avec succès pour l'acheteur.

#### B. Rejeter la plainte (`rejectDispute`)
L'Admin décide que la plainte de l'acheteur est infondée (preuve insuffisante, tentative de fraude).
- La plainte est annulée.
- Le système débloque la totalité des fonds (`RELEASED`) en faveur du vendeur.
- Le litige est clos et l'acheteur est potentiellement marqué dans l'historique de modération.

## 4. Retours de marchandises (Return OTP)
Dans certains cas extrêmes de litige, l'acheteur doit renvoyer la marchandise avant d'être remboursé.
- Un OTP spécial de retour (`Return OTP`) est généré.
- Cet OTP n'est visible que par le vendeur et l'admin.
- L'acheteur rend le produit au vendeur. Le vendeur vérifie l'état du retour et donne l'OTP de retour. 
- L'entrée de cet OTP confirme le retour physique et déclenche le remboursement effectif.
