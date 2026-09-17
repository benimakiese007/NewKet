# Roadmap : Variantes de Produits (Couleur × Taille)

Ce document trace les grandes lignes pour l'implémentation future d'un système de variantes de produits complet (Couleur × Taille) pour NewKet.

## Contexte
La fonctionnalité "Variantes" (options simples) a été retirée du code de publication (`publish.html`) et de la fiche produit (`product.html`) pour simplifier l'expérience vendeur dans l'immédiat, selon le choix de l'utilisateur. 
L'objectif à court/moyen terme est de réintroduire une gestion de variantes beaucoup plus robuste, calquée sur le modèle Amazon/Alibaba, permettant de croiser plusieurs attributs (ex: Couleur et Taille).

## Objectifs de la future implémentation
1. **Flexibilité des attributs :** Supporter des combinaisons d'attributs dynamiques (ex: T-shirt Bleu XL, Chaussure Rouge 42).
2. **Gestion fine du stock et des prix :** Chaque variante (combinaison) doit avoir son propre prix (ou modificateur de prix) et son propre niveau de stock.
3. **UX Vendeur Simple :** Un wizard ou un tableau matriciel permettant au vendeur de générer rapidement toutes les combinaisons possibles et de désactiver celles qui n'existent pas.
4. **UX Acheteur Claire :** Sur la fiche produit, des sélecteurs visuels clairs (pastilles de couleur, boutons de taille) qui mettent à jour l'image principale, le prix et le stock affiché dynamiquement.

## Conception Technique (Base de données Supabase)
La table `product_variants` actuelle utilise déjà un champ `attributes` de type `JSONB`. C'est idéal pour cette évolution.

**Structure cible du JSONB `attributes` :**
```json
{
  "color": "Bleu",
  "size": "XL",
  "material": "Coton" // Optionnel, selon les besoins futurs
}
```

**Table `product_variants` (Rappel) :**
- `id` (uuid)
- `product_id` (uuid, FK)
- `attributes` (jsonb) -> contiendra le dictionnaire Couleur/Taille
- `price` (numeric) -> le prix final de cette variante spécifique
- `old_price` (numeric) -> pour la gestion des promotions par variante
- `stock` (integer) -> le stock spécifique à cette déclinaison
- `image_url` (text) -> l'image spécifique (ex: la photo du t-shirt bleu)

## UX / UI Proposée

### 1. Côté Vendeur (`publish.html`)
- **Mode Avancé / Simple :** Un bouton toggle (ex: "Produit avec options : Couleurs, Tailles...") pour activer le mode variante.
- **Générateur de combinaisons :** 
  - Le vendeur saisit les Couleurs (ex: Rouge, Bleu) et les Tailles (ex: S, M, L).
  - Le système génère automatiquement un tableau avec les 6 lignes correspondantes (Rouge S, Rouge M, Rouge L, Bleu S, Bleu M, Bleu L).
  - Pour chaque ligne, le vendeur peut :
    - Définir le prix et le stock.
    - Uploader une image.
    - Supprimer la ligne (ex: s'il n'a pas de Rouge S).

### 2. Côté Acheteur (`product.html`)
- **Sélecteurs indépendants :** Au lieu d'une simple liste déroulante ou d'une liste de boutons génériques, afficher :
  - **Couleur :** Pastilles visuelles (si code couleur dispo) ou boutons texte.
  - **Taille :** Boutons texte (S, M, L, XL).
- **Logique de sélection croisée :**
  - Si l'utilisateur clique sur "Rouge", les tailles qui ne sont pas en stock pour "Rouge" doivent être grisées ou barrées.
  - La sélection d'une couleur met à jour l'image principale de la galerie.
  - Le prix total affiché en haut de la fiche se met à jour uniquement quand une combinaison complète (Couleur + Taille) valide est sélectionnée.

## Étapes de Développement (Roadmap)
1. **[Backend/DB]** S'assurer que les requêtes API (ou fonctions Supabase) gèrent correctement la lecture/écriture du JSONB structuré.
2. **[Backend/Validation] Définir les limites de prix (Min/Max) :** Avant toute publication, le backend doit valider que le prix saisi (ainsi que le prix de chaque variante) respecte un montant minimum et un montant maximum définis par la plateforme. Retourner une erreur explicite si la valeur est hors limites.
3. **[Frontend - Publication]** Développer le composant de génération de matrice de variantes (UI complexe, nécessite une bonne gestion de l'état en JS). Intégrer les messages d'erreur de validation de prix directement dans le formulaire.
4. **[Frontend - Fiche Produit]** Implémenter l'algorithme de croisement (filtrer les tailles disponibles selon la couleur choisie et inversement).
5. **[Frontend - Panier]** S'assurer que le panier affiche clairement les options sélectionnées (ex: "T-shirt - Bleu / XL") sous le nom du produit.

Cette fonctionnalité pourra être planifiée pour une release future selon les retours des vendeurs de la marketplace.
