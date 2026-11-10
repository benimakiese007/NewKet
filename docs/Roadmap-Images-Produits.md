# Roadmap — Politique des Images Produits NewKet

> Document de référence sur les comportements, formats, netteté et bonnes pratiques pour les images de produits sur la plateforme NewKet.

---

## 1. État actuel (Novembre 2026 — v1.0.71l)

| Paramètre | Valeur | Rôle / Impact |
|-----------|--------|---------------|
| Format d'upload accepté | **Libre (1:1, 9:16, 16:9, 3:4, etc.)** | Fini le recadrage forcé : le vendeur uploade ses photos telles quelles |
| Photo de couverture | **1er produit par défaut + modifiable en 1 clic** | Badge `⭐ Couverture` + bouton `⭐ Mettre en couverture` sur les autres photos |
| Format d'affichage (Carte) | **1:1 (Carré)** via `aspect-ratio: 1/1` en CSS | Grille d'accueil et catalogue parfaitement alignée et uniforme |
| Comportement d'affichage (Carte) | **`object-fit: contain`** sur fond doux `#f8fafc` | Le produit est 100% visible, aucun bord coupé (tête, pieds, texte) |
| Position d'affichage | **`object-position: center`** | Centrage propre du produit au milieu de la boîte |
| Transparence PNG | **Supportée à 100% via WebP avec `alpha: true`** | Pas de fond noir parasite sur les images détourées |
| Fiche Produit & Zoom | **Grand format naturel + zoom plein écran** | L'acheteur découvre le produit dans ses vraies dimensions |

---

## 2. Stratégie de Netteté & Anti-Flou (Novembre 2026)

### Le constat
Sur les écrans modernes de smartphones (iPhone Retina 3x, Samsung Super AMOLED / Dynamic AMOLED, Xiaomi OLED) et les PC récents :
* Les écrans affichent **2.5x à 3x plus de pixels physiques** que la taille apparente en CSS.
* Une miniature en `360 × 360 px` compressée à 70% est étirée par l'écran sur plus de 540 px réels, ce qui crée une impression de flou ou de voile cotonneux.

### La formule validée (Le Sweet Spot Performance / Clarté)

| Paramètre | Ancien réglage (Flou) | Nouveau réglage (Tranchant) | Impact |
|---|---|---|---|
| **Résolution miniature (`thumb`)** | `360 × 360 px` | **`640 × 640 px`** | Remplit parfaitement les écrans Retina/AMOLED sans étirement |
| **Qualité miniature WebP** | `70%` | **`85%`** | Contours nets, textes lisibles et couleurs éclatantes |
| **Résolution grand format (`full`)** | `1600 × 1600 px` | **`1800 × 1800 px`** | Zoom ultra détaillé sur la Fiche Produit |
| **Qualité grand format WebP** | `78%` | **`88%`** | Piqué professionnel pour la vue détaillée |
| **Poids estimé d'une carte** | ~15 Ko | **~40 à 50 Ko** | Reste ultra rapide même sur connexion 3G/4G en RDC |

### Optimisations UX validées & rejetées

* ✅ **Double niveau intelligent (Carte vs Fiche) :** Miniature 640px légère pour faire défiler le catalogue à toute vitesse + photo HD chargée uniquement à l'ouverture de la Fiche Produit.
* ✅ **Chargement progressif (Smooth Fade-in / Blur) :** Transition douce à l'affichage pour éviter les sauts visuels bruts.
* ✅ **Micro-accentuation CSS :** Accentuation légère des contrastes (`contrast: 1.02`) pour redonner du piquant aux textures et coutures.
* ❌ **Simulateur de rendu pour le vendeur (Rejeté) :** Trop lourd et friction inutile pour le vendeur qui veut publier et vendre vite.

---

## 3. Les formats d'images expliqués

### Ratios courants
| Ratio | Format | Usage recommandé |
|-------|--------|------------------|
| **1:1** | Carré parfait | Accessoires, montres, cosmétiques, chaussures |
| **3:4 / 9:16** | Portrait / Smartphone | Mode, vêtements longs, mannequins |
| **16:9 / 4:3** | Paysage | High-tech (PC portables, TV), électronique, mobilier |

### Comportements `object-fit`
| Valeur | Effet | Décision NewKet |
|--------|-------|-----------------|
| **`contain`** ✅ | Tout voir sans couper, posé au centre sur fond neutre | **Adopté sur la Carte Produit** pour ne jamais tronquer un article |
| **`cover`** | Remplit toute la case, coupe les extrémités | Réservé aux bannières et fonds décoratifs |
| **`fill`** ❌ | Étire et déforme le produit | Banni |

---

## 4. Recommandations aux vendeurs

> Directives simplifiées pour l'onboarding vendeur et la page `publish.html`.

* **Prise de vue :** Prendre la photo en centrant bien l'article.
* **Résolution minimale :** 800 × 800 px (recommandé : 1200 × 1200 px ou plus).
* **Fond :** Fond blanc, neutre ou transparent (détouré) très valorisant.
* **Formats acceptés :** `.jpg`, `.png` (détouré avec transparence), `.webp`.
* **Choix de la couverture :** Toujours cliquer sur sa meilleure photo pour la désigner comme `⭐ Couverture`.

---

## 5. Historique des implémentations techniques

| Date | Fichiers modifiés | Description | Version OTA |
|------|-------------------|-------------|-------------|
| Sept. 2026 | `style.css` | Remplacement de `height: 240px` par `aspect-ratio: 1/1` | - |
| Nov. 2026 | `publish.html` | Suppression du crop forcé Cropper.js, upload libre tous formats | v1.0.71a |
| Nov. 2026 | `publish.html` | Bouton "⭐ Mettre en couverture" avec réorganisation dynamique | v1.0.71a |
| Nov. 2026 | `style.css` | Carte Produit en `object-fit: contain` sur fond `#f8fafc` | v1.0.71a |
| Nov. 2026 | `supabase-adapter.js` | Correction du canvas alpha (suppression de `alpha: false`, zéro fond noir PNG) | v1.0.71a |
| Nov. 2026 | `supabase-adapter.js` | Anti-flou : miniatures `640px @ 85%` et grand format `1800px @ 88%` | v1.0.71l |

---

*Dernière mise à jour : 10/11/2026 — Anti-flou implémenté et shipé en OTA v1.0.71l.*
