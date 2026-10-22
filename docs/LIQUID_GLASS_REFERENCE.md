# Guide de Référence & Règles de Conception — Apple Liquid Glass (iOS 26+)

> **Statut :** Production Ready — Validé sur NewKet iOS Capacitor  
> **Dernière mise à jour :** Octobre 2026  
> **Composants couverts :** TabBar native SwiftUI, Boutons d'en-tête (Burger, Loupe, Sortie), Intégration hybride Capacitor.

---

## 1. Vue d'Ensemble de l'Architecture

NewKet combine une application Web Capacitor avec des **composants natifs Liquid Glass** qui flottent au-dessus de la WebView pour offrir un rendu 100% indifférenciable d'une app iOS native haut de gamme :

```
┌────────────────────────────────────────────────────────┐
│  Bandeau En-tête Natif (NativeHeaderButtonsPlugin)      │
│  [Burger 48x48]                   [Loupe/Sortie 48x48] │
├────────────────────────────────────────────────────────┤
│                                                        │
│               WKWebView (Page Web / PWA)               │
│                                                        │
├────────────────────────────────────────────────────────┤
│  Barre d'onglets Native SwiftUI (NativeTabBarPlugin)   │
│  [Accueil]   [Catalogue]   [Boutique]   [Panier] [Moi] │
└────────────────────────────────────────────────────────┘
```

---

## 2. Les Boutons d'En-tête (`NativeHeaderButtonsPlugin.swift`)

### Spécifications Géométriques

| Propriété | Valeur Standard | Description |
|---|---|---|
| **Forme** | Sphère / Capsule circulaire | `cornerRadius = 24 pt` avec `cornerCurve = .circular` |
| **Dimensions du bouton** | **`48 × 48 pt`** | Taille optimale pour visibilité et confort tactile |
| **Zone tactile (Hit Target)** | **`48 × 48 pt`** | Conforme Apple HIG (minimum 44×44 pt requis) |
| **Taille de l'icône SF Symbol** | **`20 pt`** | Poids `.semibold`, couleur blanche |
| **Hauteur du bandeau conteneur** | `safeAreaInsets.top + 54 pt` | S'adapte à la Dynamic Island et l'encoche |
| **Marge latérale (Leading/Trailing)** | `16 pt` | Alignement avec les marges système iOS |
| **Marge inférieure (Bottom)** | `-4 pt` | Centrage vertical dans la zone utile de 54 pt |
| **Ombre portée (Shadow)** | Rayon `5 pt`, opacité `0.22`, décalage `(0, 2)` | Élévation 3D subtile |

---

## 3. Les Règles d'Or de la Physique Tactile Liquid Glass

### 🚫 Règle N°1 : ZÉRO Déplacement Physique (Pas de translation)
- **Le piège :** Déplacer le bouton avec `CGAffineTransform(translationX: ...)` lorsque le doigt bouge donne l'impression d'un widget flottant mal fixé ou d'un bug graphique.
- **La règle Apple :** Le bouton reste **strictement fixé à ses coordonnées d'ancrage**. C'est le matériau de verre qui réagit en profondeur, pas le bouton qui glisse sur l'écran.

### 💧 Règle N°2 : Activer la Matière Optique Interactive
- Toujours configurer `glass.isInteractive = true` sur `UIGlassEffect()`.
- Cela ordonne au moteur de rendu Metal/iOS de calculer en temps réel la réfraction optique, les reflets spéculaires et la lueur interne sous le doigt.

### 🤏 Règle N°3 : Compression Élastique au Toucher (`touchesBegan`)
- Au moment du contact avec le doigt :
  - Déclencher un retour haptique doux : `UIImpactFeedbackGenerator(style: .light)`.
  - Comprimer la capsule sur place : `scale: 0.94`, `alpha: 0.92`.
  - Animation ressort courte : `usingSpringWithDamping: 0.70`, `duration: 0.20s`.

### 🎯 Règle N°4 : Suivi de Zone Sans Glissement (`touchesMoved`)
- Lorsque le doigt bouge :
  - **Ne pas appliquer de translation.**
  - Vérifier si le point de contact est toujours à l'intérieur de la zone tactile (`point(inside: ...)`).
  - Si le doigt sort : ramener doucement le bouton à `scale: 1.0` (annulation visuelle).
  - Si le doigt revient dedans : re-comprimer à `scale: 0.94`.

### 🔄 Règle N°5 : Rebond Élastique au Relâchement (`touchesEnded`)
- Au moment où le doigt se lève :
  - Rebond à ressort vers la forme de repos : `scale: 1.0`, `duration: 0.38s`, `usingSpringWithDamping: 0.55`, `initialSpringVelocity: 0.8`.
  - Si le relâchement a eu lieu dans la zone du bouton : retour haptique de sélection (`UISelectionFeedbackGenerator().selectionChanged()`) et exécution immédiate de l'action (`onTap?()`).

---

## 4. La Barre d'Onglets Native (`NativeTabBarPlugin.swift`)

### Architecture SwiftUI & Compatibilité Multi-Versions

```swift
Group {
    if #available(iOS 18.0, *) {
        // Syntaxe moderne SwiftUI — Liquid Glass natif
        TabView(selection: ...) {
            ForEach(coordinator.tabs) { tab in
                Tab(tab.label, systemImage: tab.systemImage, value: tab.id) {
                    CapacitorWebViewRepresentable(bridgeVC: bridgeVC)
                        .ignoresSafeArea()
                        .toolbar(coordinator.isTabBarHidden ? .hidden : .visible, for: .tabBar)
                }
                .badge(coordinator.badges[tab.id] ?? 0)
            }
        }
        .toolbar(coordinator.isTabBarHidden ? .hidden : .visible, for: .tabBar)
        .tint(Color.primary)
    } else if #available(iOS 16.0, *) {
        // Fallback pour iOS 16 et 17
        TabView(selection: ...) {
            ForEach(coordinator.tabs) { tab in
                CapacitorWebViewRepresentable(bridgeVC: bridgeVC)
                    .ignoresSafeArea()
                    .toolbar(coordinator.isTabBarHidden ? .hidden : .visible, for: .tabBar)
                    .tabItem { Label(tab.label, systemImage: tab.systemImage) }
                    .tag(tab.id)
                    .badge(coordinator.badges[tab.id] ?? 0)
            }
        }
        .toolbar(coordinator.isTabBarHidden ? .hidden : .visible, for: .tabBar)
        .tint(Color.primary)
    } else {
        // Fallback universel (< iOS 16, sans .toolbar(for: .tabBar))
        TabView(selection: ...) {
            ForEach(coordinator.tabs) { tab in
                CapacitorWebViewRepresentable(bridgeVC: bridgeVC)
                    .ignoresSafeArea()
                    .tabItem { Label(tab.label, systemImage: tab.systemImage) }
                    .tag(tab.id)
            }
        }
        .tint(Color.primary)
    }
}
```

### Règle Critique de Compatibilité Compilateur (Xcode)
> [!WARNING]
> `.toolbar(_:for: .tabBar)` a été introduit avec iOS 16.0. Ne JAMAIS l'appeler dans une clause `else` globale sans `if #available(iOS 16.0, *)`, sinon le compilateur Xcode sur CI/GitHub Actions/Codemagic échoue avec une erreur `exit code 65`.

---

## 5. Règles d'Intégration Web / Hybride (`components-loader.js`)

Pour que les éléments natifs ne rentrent jamais en conflit avec le DOM web :

### 1. Masquage Automatique lors des Tiroirs / Modales Web
Dès qu'un élément plein écran ou coulissant apparaît dans la page web (Menu latéral, Panier slide-over, Favoris, Notifications, Barre de recherche mobile, Modales de confirmation), les boutons et la TabBar natifs **doivent disparaître instantanément** :
```javascript
const _hideButtons = () => {
    plugin.update({ showLeft: false, showRight: false });
    NativeTabBar?.hide();
};
```
Et réapparaître dès la fermeture complète avec un debounce de sécurité (`120ms`).

### 2. Dégagement de la Zone Basse (Safe Area Clearance)
Pour que le contenu de la WebView ne soit jamais masqué par la TabBar flottante :
```css
/* Appliqué dans style.css */
main, #main-content, .page-content, .customer-main-content, .vendor-main-content {
    padding-bottom: calc(116px + env(safe-area-inset-bottom, 34px)) !important;
}
```

### 3. Masquage au Démarrage (Launch / Splash Screen)
- La TabBar démarre avec `isTabBarHidden = true`.
- Les barres natives ne sont dévoilées qu'après les événements `componentsLoaded` ou `newketReady` (avec un fallback de sécurité à `1600ms` correspondant à la durée du splash natif).

---

## 6. Le Toggle de Devise Liquid Glass (html.is-ios-capacitor .currency-switch-segmented)

Exclusif à l'application iOS Capacitor (sans impact sur le site web officiel) :

| Propriété | Spécification Apple Liquid Glass |
|---|---|
| **Forme du réservoir (Track)** | Capsule pilule ronde (order-radius: 9999px), dimensions 90 × 32 pt |
| **Matière du réservoir** | Verre dépoli 
gba(255, 255, 255, 0.18) avec ackdrop-filter: blur(20px) saturate(180%) |
| **Bordure & Biseau** | order: 1px solid rgba(255, 255, 255, 0.28), inset shadow blanc pour l'épaisseur du verre |
| **Pastille coulissante (Handle)** | Capsule blanche nacrée bombée 42 × 25 pt avec biseau supérieur de lumière et ombre portée 3D |
| **Physique de ressort** | Courbe Apple Spring : 	ransition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) |
| **Compression au toucher** | Légère réduction élastique à scale(0.95) sur :active |
| **Labels & Contraste** | Devise active en #0f172a gras sur verre blanc ; devise inactive en blanc translucide 70% |
