# Roadmap — Politique des Images Produits NewKet

> Document de référence sur les comportements, formats et bonnes pratiques pour les images de produits sur la plateforme NewKet.

---

## 1. État actuel (Septembre 2026)

| Paramètre | Valeur |
|-----------|--------|
| Format imposé | **1:1 (Carré)** via `aspect-ratio: 1/1` en CSS |
| Comportement de remplissage | **`object-fit: cover`** |
| Position | **`object-position: top center`** |
| Hauteur fixe mobile (avant) | `160px` — **supprimée** |
| Hauteur fixe desktop (avant) | `240px` — **supprimée** |

### Ce que ça signifie en pratique
- Toutes les images s'affichent en **carré parfait**, quelle que soit la taille de l'écran.
- Si l'image du vendeur est rectangulaire, le navigateur **zoom et coupe** les bords (cover).
- La grille est **uniforme et propre** — rendu type vitrine de luxe (Zara, Instagram).

---

## 2. Les formats d'images expliqués

### Ratios disponibles

| Ratio | Format | Usage recommandé |
|-------|--------|------------------|
| **1:1** ✅ (actuel) | Carré parfait | Grilles produits, marketplace, mode |
| **3:4** | Portrait | Mode, vêtements, accessoires |
| **4:3** | Paysage classique | Électronique, déco intérieure |
| **16:9** | Cinémascope | Bannières, héros, vidéos |
| **9:16** | Plein écran mobile | Stories, promotions mobiles |

### Comportements `object-fit`

| Valeur | Effet | Avantage | Inconvénient |
|--------|-------|----------|--------------|
| **`cover`** ✅ (actuel) | Remplit tout, coupe ce qui dépasse | Grille uniforme | Peut couper des détails |
| `contain` | Tout voir, sans couper | Produit 100% visible | Bandes blanches/grises |
| `fill` | Étire/écrase pour remplir | Aucun | Déforme le produit ❌ |
| `none` | Taille naturelle de l'image | — | Incohérent sur la grille ❌ |

---

## 3. Recommandations aux vendeurs

> À intégrer dans le **guide d'onboarding vendeur** et sur la page `publish.html`.

### ✅ Format idéal
- **Ratio** : **1:1** (carré)
- **Résolution minimum** : `800 × 800 px`
- **Résolution recommandée** : `1200 × 1200 px`
- **Poids maximum** : `2 Mo` (Cloudinary s'occupe de l'optimisation)
- **Formats acceptés** : `.jpg`, `.webp`, `.png`

### 📸 Conseils de prise de vue
- Centrer le produit dans le cadre (éviter de le mettre sur un bord)
- Fond blanc ou neutre recommandé pour les produits de luxe
- Éviter les images en portrait (le haut et le bas seront coupés)
- Au minimum **1 photo principale + 2 photos supplémentaires**

---

## 4. Évolutions futures envisagées

### Court terme
- [ ] Afficher un **avertissement dans `publish.html`** si l'image uploadée n'est pas carrée ou trop petite
- [ ] Ajouter un **recadrage interactif** à l'upload (crop tool 1:1 avant envoi)

### Moyen terme
- [ ] Permettre aux vendeurs de choisir **le point de focus** de leur image (ex: "recadrer en gardant le centre" vs "garder le haut")
- [ ] Support du **format 3:4 en option** pour les boutiques mode/fashion, avec basculement par catégorie

### Long terme
- [ ] Génération automatique de **miniatures multi-formats** via Cloudinary (1:1 pour la grille, 3:4 pour la page produit, 16:9 pour les bannières promo)
- [ ] **Score de qualité image** affiché au vendeur dans son dashboard (résolution, centrage, luminosité)

---

## 5. Implémentations techniques réalisées

| Date | Fichier modifié | Description |
|------|----------------|-------------|
| Sept. 2026 | `frontend/src/assets/css/style.css` | Remplacement de `height: 240px` par `aspect-ratio: 1/1` sur `.product-image` |
| Sept. 2026 | `frontend/src/assets/css/style.css` | Suppression du `height: 160px` mobile sur `.product-image` |

---

*Document créé le 09/09/2026 — À mettre à jour à chaque décision d'évolution des images.*
