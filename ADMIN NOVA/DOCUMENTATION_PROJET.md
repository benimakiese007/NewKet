# NOVA V2 - Documentation du Projet

## 1. Vue d'ensemble
ENova V2 (ENova EMarket) est une plateforme e-commerce moderne conçue pour offrir une expérience d'achat premium.
Le projet est construit comme une **Single Page Application (SPA) hybride**, utilisant des fichiers HTML statiques interconnectés mais partageant une logique JavaScript centralisée pour simuler un backend dynamique.

**Principal avantage technique :** L'application fonctionne entièrement côté client sans base de données serveur pour le moment (Serverless), utilisant `localStorage` pour la persistance des données. Cela permet un déploiement et des tests immédiats sans configuration complexe.

## 2. Architecture Technique

### Technologies Utilisées
- **Frontend :** HTML5, CSS3 (Vanilla + Variables CSS modernes), JavaScript (ES6+).
- **Icônes :** FontAwesome.
- **Police :** Google Fonts (Inter/Outfit).
- **Données :** LocalStorage (persistantes dans le navigateur).

### Structure des Dossiers
```
NOVA V2/
├── ADMIN NOVA/       # Interface d'Administration
│   ├── index.html    # Login Admin
│   ├── dashboard.html
│   ├── products.html # Gestion produits
│   └── ...
├── css/              # Styles
│   ├── style.css     # Styles principaux (Client)
│   └── admin.css     # Styles spécifiques Admin
├── js/               # Logique
│   └── main.js       # Cœur du système (Managers)
├── Images/           # Ressources graphiques
└── *.html            # Pages Client (index, catalog, cart, etc.)
```

## 3. Fonctionnalités Clés

### Côté Client (Site UI)
1.  **Catalogue Dynamique :** Les produits sont chargés dynamiquement via Javascript (`ProductManager`).
2.  **Gestion Panier & Favoris :** Ajout/Suppression avec mise à jour en temps réel des badges et persistance.
3.  **Multi-Devise :** Conversion automatique CDF (Franc Congolais) / USD avec un taux défini (par défaut 2500 FC = 1$).
4.  **Recherche & Filtres :** (Fonctionnalités prévues dans la structure UI).
5.  **Système de Toasts :** Notifications visuelles lors des actions (ajout panier, favoris, etc.).

### Côté Administration (Admin Panel)
Le dossier `ADMIN NOVA` contient les outils pour gérer le site. Grâce au partage du `localStorage`, les modifications faites ici se reflètent immédiatement sur le site client.
1.  **Dashboard :** Vue d'ensemble des ventes et commandes.
2.  **Produits :** Ajouter, modifier, supprimer des produits.
3.  **Commandes :** Suivre le statut des commandes (En attente, Livré, etc.).
4.  **Codes Promo :** Créer des codes de réduction (pourcentage ou fixe) avec expiration.

## 4. Documentation du Code (js/main.js)
Le fichier `js/main.js` est le moteur de l'application. Il expose plusieurs "Managers" globaux :

- **`CurrencyManager`** : Gère la devise active et le formatage des prix.
- **`CartManager`** : Gère le tableau du panier, les quantités et le badge du header.
- **`FavoritesManager`** : Gère la liste de souhaits (Wishlist).
- **`ProductManager`** : CRUD (Create, Read, Update, Delete) pour les produits. Initialise des produits par défaut si la base est vide.
- **`OrderManager`** : Gère la création et le suivi des commandes.
- **`PromoManager`** : Logique de validation et d'application des codes promotionnels.

## 5. Guide d'Installation / Utilisation
1.  **Lancement :** Aucune installation requise. Ouvrez simplement `index.html` dans un navigateur.
2.  **Administration :** Pour accéder au back-office, ouvrez `ADMIN NOVA/dashboard.html` (ou via le lien "Compte" -> Admin si configuré).
3.  **Réinitialisation :** Pour remettre le site à zéro (produits par défaut), effacez le `localStorage` de votre navigateur (Application > Local Storage > Clear).

## 6. Prochaines Étapes Possibles
- Intégrer un vrai backend (Node.js/Firebase) pour remplacer le localStorage.
- Système d'authentification utilisateur sécurisé.
- Intégration de paiement réel (API Mobile Money).
