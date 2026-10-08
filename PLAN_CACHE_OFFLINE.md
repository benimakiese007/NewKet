# Plan d'Implémentation : Cache Intelligent (Offline-Friendly)

## Objectif
Permettre à l'application NewKet (construite avec Vite + Capacitor) de rester utilisable en lecture seule lorsque l'utilisateur perd sa connexion, en adaptant l'expérience selon son rôle (`customer`, `supplier`, `admin`).

---

## Étape 1 : Choix de la technologie de stockage
- **IndexedDB** via `idb-keyval` — stockage local persistant, rapide, gérant de grosses quantités de données JSON.
- **Service Worker (PWA)** via `vite-plugin-pwa` — mise en cache du code (HTML/CSS/JS) pour le fonctionnement Web sans dinosaure.

---

## Étape 2 : Comportement par Rôle & Architecture du Cache

### 🌟 Ce qui est commun à TOUS LES COMPTES (Client, Vendeur, Admin)
Peu importe le rôle de l'utilisateur, s'il est hors ligne, il a un accès en lecture seule à :
| Clé de cache | Contenu sauvegardé | Limite | Durée |
|---|---|---|---|
| `cache_home_feed` | Accueil, Produits phares, Catégories | Tout | 7 jours |
| `cache_catalog_products`| Catalogue public | 20 produits | 7 jours |
| `cache_recent_products` | Historique de navigation (Derniers vus) | 20 produits | 7 jours |
| `cache_favorites` | **Wishlist / Favoris** | Tout | 7 jours |
| `cache_notifications` | **Notifications reçues** | Les 30 dernières | 7 jours |
| `cache_user_profile` | Paramètres (Settings), adresses, infos | Tout | 7 jours |
| `cache_static_pages` | FAQ, CGV, À propos, Contact... | Tout | 30 jours |

### 🛒 Spécifique au `customer` (Client)
| Clé de cache | Contenu sauvegardé | Limite | Durée |
|---|---|---|---|
| `cache_customer_orders` | Historique des commandes personnelles | 10 commandes | 7 jours |
| `cache_cart_summary` | Nombre d'articles, total estimé | Résumé | 7 jours |

### 🏬 Spécifique au `supplier` (Vendeur)
| Clé de cache | Contenu sauvegardé | Limite | Durée |
|---|---|---|---|
| `cache_vendor_orders` | Commandes à préparer / expédier | Les 50 dernières | 7 jours |
| `cache_vendor_products` | Catalogue complet de son propre stock | Tout le stock | 7 jours |
| `cache_vendor_stats` | Solde actuel, ventes de la veille | Résumé | 7 jours |

### 🛡️ Spécifique à l'`admin` (Administrateur)
- Accès au cache commun (Accueil, Favoris, Notifications, etc.) autorisé.
- **Back-Office Bloqué :** Le dashboard complet (`pages/admin/*`) n'est **jamais** mis en cache. Tout accès est bloqué hors ligne pour empêcher les manipulations à l'aveugle.

---

## Étape 3 : Logique de Lecture & Verrouillage (Hors ligne)

Si `navigator.onLine === false` :

### Ce qui fonctionne (Lecture seule fluide) :
- Naviguer sur l'accueil, le catalogue, lire ses notifications, consulter ses favoris.
- Vérifier ses adresses ou ses paramètres de compte.

### Ce qui est bloqué (Sécurité des données) :
- **Page Paramètres :** Le bouton "Sauvegarder" est désactivé avec un Toast.
- **Actions E-commerce :** Impossible d'ajouter au panier ou de payer.
- **Actions Vendeur :** Impossible de modifier un produit ou d'expédier une commande.
- **Actions Admin :** Le dashboard d'administration affiche un overlay de sécurité exigeant la connexion.

---

## Étape 4 : Invalidation et Nettoyage
- Lancement de l'app **avec réseau** : Suppression des clés périmées (> 7 ou 30 jours).
- **Déconnexion (`logout`)** : Vidage intégral d'IndexedDB (`clearAllCache()`).
