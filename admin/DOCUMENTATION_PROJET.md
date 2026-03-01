# NewKet - Documentation du Projet

## 1. Vue d'ensemble
NewKet V2 (NewKet EMarket) est une plateforme e-commerce moderne conçue pour offrir une expérience d'achat premium.
Initialement basé sur `localStorage`, le projet a migré vers **Supabase** pour offrir une persistance de données robuste, une gestion des utilisateurs sécurisée et une évolutivité accrue.

**Architecture Technique :** L'application est une Single Page Application (SPA) hybride. Elle utilise des fichiers HTML statiques interconnectés, partageant une logique JavaScript centralisée qui communique avec le backend via un adaptateur Supabase.

## 2. Architecture Technique

### Technologies Utilisées
- **Frontend :** HTML5, CSS3 (Vanilla + Variables CSS modernes), JavaScript (ES6+).
- **Backend (BaaS) :** Supabase (PostgreSQL, Auth, Storage).
- **Communication :** `SupabaseAdapter` (couche d'abstraction personnalisée).
- **Icônes :** FontAwesome & Iconify.
- **Police :** Google Fonts (Inter/Outfit).
- **Données :** Supabase (Persistance réelle) + LocalStorage (Cache & Synchronisation).

### Structure des Dossiers
```
NewKet/
├── ADMIN NewKet/       # Interface d'Administration (Dashboard, Commandes, Produits)
├── css/              # Styles (style.css, admin.css)
├── js/               # Logique de l'application
│   ├── main.js       # Cœur du système (Managers client)
│   ├── supabase-client.js # Configuration SDK Supabase
│   └── supabase-adapter.js # Abstraction CRUD, Cache TTL et Retry
├── Images/           # Ressources graphiques
├── supabase/         # Scripts SQL et configuration de la base
└── *.html            # Pages Client (index, catalog, cart, etc.)
```

## 3. Gestion des Données (Supabase)

Le projet utilise Supabase pour stocker toutes les données critiques. La sécurité est assurée par des politiques **RLS (Row Level Security)**.

- **Utilisateurs :** Gérés via Supabase Auth. Les rôles (`customer`, `supplier`, `admin`) sont stockés dans les métadonnées de l'utilisateur.
- **Produits :** Table `products`. Seuls les administrateurs et fournisseurs peuvent modifier le stock.
- **Commandes :** Table `orders`. Synchronisation en temps réel pour le suivi.
- **Panier & Favoris :** Stockés localement pour la réactivité (UX), mais synchronisés avec Supabase (`user_carts`, `user_favorites`) lors de la connexion pour une expérience multi-appareil.

## 4. Fonctionnalités Clés

### Côté Client (Site UI)
1. **Catalogue Dynamique :** Produits chargés via `ProductManager` depuis Supabase.
2. **Multi-Devise :** Conversion intelligente CDF/USD gérée par `CurrencyManager` avec support de taux personnalisés par produit.
3. **Recherche Instantanée :** Filtrage côté client et serveur pour une performance optimale.
4. **Système de Points :** Programme de fidélité automatique basé sur les achats.
5. **Mode Hors-Ligne (PWA) :** Support de base pour la navigation hors-ligne via Service Workers.

### Côté Administration & Vendeurs
1. **Panneau Admin :** Gestion globale (Produits, Commandes, Utilisateurs, Promos).
2. **Dashboard Vendeur :** Statistiques spécifiques pour les fournisseurs (ventes, gains nets, commissions).
3. **Gestion des Stocks :** Mise à jour en temps réel des quantités et statuts.
4. **Code Promo :** Système de réduction avec limites d'utilisation et dates d'expiration.

## 5. Documentation du Code (js/)

- **`SupabaseAdapter`** : Le moteur d'interaction avec la base de données. Gère le cache (TTL), les tentatives automatiques (Retry) et l'invalidation du cache après mutation.
- **`AuthManager`** : Gère les sessions, les rôles et les redirections de sécurité basées sur les permissions.
- **`CartManager` / `FavoritesManager`** : Logique de gestion hybride (Local + Cloud Sync).
- **`OrderManager`** : Calcul complexe des statistiques, gains et commissions.

## 6. Installation et Déploiement

1. **Configuration :** Les clés API Supabase se trouvent dans `js/supabase-client.js`.
2. **Base de données :** Le schéma SQL est disponible dans `schema.sql` pour initialiser une nouvelle instance.
3. **Lancement :** Serveur local (via Live Server ou `python -m http.server`).
4. **Maintenance :** Pour réinitialiser le cache local, utilisez les outils de développement du navigateur (Application -> Storage).

---
*Dernière mise à jour : Février 2026*
