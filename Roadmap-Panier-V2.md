# Roadmap : Logique du Panier et Paiement (Multi-Vendeurs)

Ce document trace l'évolution de la logique de passage en caisse (Checkout) pour la marketplace NewKet, en tenant compte des contraintes de paiement (FlexPay) et de sécurité des livraisons (OTP par transaction).

## Version 1 : Checkout par Article (Lancement)
Pour la V1, l'approche retenue est celle de l'achat atomique (type Facebook Marketplace / LeBonCoin).

**Logique UI / UX :**
- Suppression du bouton global "Passer à la caisse" et du total global en bas du panier.
- Ajout d'un bouton "Passer à la caisse" (Call to Action) indépendant **à l'intérieur de chaque carte produit** dans le panier.

**Fonctionnement technique :**
- 1 Produit = 1 Clic sur Commander = 1 Paiement FlexPay = 1 Commande en DB = 1 Code OTP.
- **Avantages :** 
  - Simplicité technique absolue.
  - Sécurité totale : le code OTP remis par l'acheteur au vendeur débloque l'escrow uniquement pour cet article précis.
  - S'adapte parfaitement aux achats uniques et impulsifs.

---

## Version 2 : Checkout par Vendeur (Roadmap)
À mesure que la plateforme grandira, certains clients voudront acheter plusieurs articles chez un **même vendeur** en une seule fois. 

**Problème à résoudre (Limites de la V1) :**
Si un client achète 3 articles chez le même vendeur en V1, il subit 3 passages par FlexPay, 3 fois les frais de transaction, et reçoit 3 codes OTP pour une seule livraison groupée.

**Logique UI / UX prévue pour la V2 :**
- Regroupement visuel des articles du panier par Vendeur (ex: Bloc "Boutique de Marc", Bloc "Boutique de Sophie").
- Un seul bouton "Commander chez ce vendeur" par bloc.

**Fonctionnement technique prévu :**
- Le client clique sur "Commander chez Marc" (qui contient 3 articles).
- **1 seul paiement FlexPay** combinant le prix des 3 articles.
- **1 seul code OTP** généré pour la livraison globale de cette sous-commande.
- Le backend crée une commande parent (ou relie les 3 articles à un seul identifiant de livraison/transaction).
- **Avantages :** Gain de temps pour le client, réduction des frais de transaction (1 seul prélèvement), et simplification de la livraison (1 seul OTP à vérifier par le vendeur pour son colis groupé).
