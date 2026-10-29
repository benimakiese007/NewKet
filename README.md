<div align="center">

  <img src="frontend/public/Images/Logo NewKet PNG.png" alt="NewKet Logo" width="160" height="auto" />

  # NewKet (Marketplace RDC)
  
  **La marketplace e-commerce & mobile haut de gamme de référence en République Démocratique du Congo.**

  [![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![Vite](https://img.shields.io/badge/Frontend-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Express.js](https://img.shields.io/badge/Backend-Express%205-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
  [![Capacitor](https://img.shields.io/badge/Mobile-Capacitor%20iOS%20%26%20Android-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
  [![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
  [![iOS 18 Widgets](https://img.shields.io/badge/Apple-WidgetKit%20%26%20Liquid%20Glass-000000?style=for-the-badge&logo=apple&logoColor=white)](https://developer.apple.com/)
  [![CI/CD Status](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/benimakiese007/NewKet/actions)

  <p align="center">
    <a href="#-à-propos">À propos</a> •
    <a href="#-architecture-du-monorepo">Architecture</a> •
    <a href="#-fonctionnalités-phares">Fonctionnalités</a> •
    <a href="#-stack-technologique">Stack</a> •
    <a href="#-démarrage-rapide">Démarrage</a> •
    <a href="#-variables-denvironnement">Environnement</a> •
    <a href="#-déploiement--cicd">CI/CD & iOS</a> •
    <a href="#-qualité--scripts">Qualité</a>
  </p>

</div>

---

## 🌟 À propos

**NewKet** est une plateforme e-commerce moderne conçue pour répondre aux réalités économiques et d'usages en **République Démocratique du Congo (Kinshasa)** tout en offrant les standards d'une expérience mobile native d'exception.

NewKet combine une application web progressive (**PWA**) ultra-légère et performante, avec des applications mobiles hybrides **Capacitor (iOS & Android)** enrichies de composants natifs haute fidélité (Apple Liquid Glass, Widgets d'écran d'accueil iOS 18, Quick Actions, retours haptiques).

### 💡 Piliers stratégiques
1. **Confiance & Escrow Tiers de Confiance** : Système de séquestre garantissant que l'acheteur est protégé à 100% et que le vendeur est assuré d'être payé dès confirmation physique par code OTP.
2. **Mobile Money First** : Intégration des moyens de paiement phares de RDC (**M-Pesa, Airtel Money, Orange Money**) via passerelle sécurisée FlexPaie.
3. **Zéro Friction & Ergonomie Premium** : Tiroirs latéraux fluides (Drawers pour le panier, les favoris et les notifications), navigation native instantanée et architecture zéro-bloatware.
4. **Recherche Visuelle IA (NewKet Lens)** : Recherche de produits à partir d'une simple photo grâce à un modèle d'embeddings vectoriels.

---

## 🏗️ Architecture du Monorepo

Le projet est structuré en monorepo clair et modulaire :

```text
NewKet/
├── frontend/                     # Application Frontend (Vite + Vanilla JS modulaire + TailwindCSS)
│   ├── src/pages/                # Pages HTML principales (index, catalog, product, shop, etc.)
│   ├── public/                   # Assets statiques, images, PWA manifest, scripts partagés
│   │   ├── js/                   # Modules JS (drawers, cart, auth, realtime, router)
│   │   └── vendor/               # Librairies externes pré-packagées (Iconify, etc.)
│   └── ios/                      # Projet natif iOS (Capacitor + Swift + SwiftUI Widgets)
│       └── App/
│           ├── App/              # Code Swift natif (Coordinateur, plugins TabBar, Quick Actions)
│           └── NewKetWidgetExtension/ # Widgets iOS 18 (Small, Medium, Large Sponsored Products)
│
├── backend/                      # API REST & WebSocket (Node.js ES Modules + Express 5)
│   ├── src/
│   │   ├── controllers/          # Contrôleurs métier (produits, boutiques, escrow, paiements)
│   │   ├── routes/               # Définition des endpoints REST sécurisés
│   │   ├── middleware/           # Authentification Supabase, rate limiting, validation
│   │   └── services/             # Intégrations FlexPaie, Cloudinary, Sentry, HuggingFace
│   └── scripts/                  # Indexation des embeddings et maintenance
│
├── ai-service/                   # Service d'Intelligence Artificielle & NewKet Lens
├── database/                     # Migrations SQL, schémas Supabase, RLS policies & Triggers
├── docs/                         # Spécifications fonctionnelles et guides d'architecture
├── scripts/                      # Scripts d'orchestration de développement (dev-all, bat)
├── tools/                        # Outils d'audit interne (détecteur Mojibake / intégrité UTF-8)
└── tests/                        # Tests automatisés E2E (Playwright) et tests unitaires
```

---

## 🚀 Fonctionnalités Phares

### 🛍️ Expérience E-commerce & Shopping
- **Catalogue Dynamique & Filtrage Géolocalisé** : Filtrage par catégories, fourchettes de prix, communes de Kinshasa et disponibilité en stock.
- **Tiroirs Latéraux (Drawers Fluid)** :
  - **Panier dynamique** : Ajout en un clic, gestion instantanée des quantités, calcul automatique.
  - **Favoris synchronisés** : Sauvegarde locale et cloud en temps réel.
  - **Centre de notifications** : Mises à jour en direct (commandes, livraisons, promos) sans changement de page.
- **Fiches Produits Riches** : Galerie multi-angles Cloudinary, sélecteur de variantes, avis vérifiés et notation.

### 💳 Paiements Escrow & Mobile Money (FlexPaie)
- **Séquestre Automatique (Escrow)** : Lors de la commande, les fonds sont bloqués sur un compte de cantonnement sécurisé.
- **Validation OTP à la livraison** : Le client valide la réception physique via un code OTP unique, ce qui déclenche instantanément le virement vers le Mobile Money du vendeur.
- **Politique de Litiges Arbitrée** : Arbitrage 100% humain pour une équité totale, sans robots de blocage.

### 🍏 Expérience Native iOS (Apple Liquid Glass)
- **Native TabBar Coordinator** : Barre de navigation native ultra-fluide avec bascule automatique des icônes SF Symbols (`outline` ↔ `.fill` sur l'onglet actif).
- **Widgets d'Écran d'Accueil (iOS 18 WidgetKit)** :
  - **Widget Large (Sponsorisé)** : Affiche en temps réel les 4 articles vedettes avec miniatures Cloudinary optimisées (~10 Ko) et prix en Francs Congolais (CDF).
  - Rafraîchissement automatique d'arrière-plan toutes les 2h + rechargement intelligent à l'ouverture de l'application (throttlé à 15 min).
  - Deep linking direct : toucher un article dans le widget ouvre directement la page produit dans l'application.
- **iOS Quick Actions (3D Touch / Haptic Touch)** :
  - Accès direct depuis l'icône de l'application : *Accueil*, *Recherche*, *Boutiques*, *Mon Compte*.

### 🔍 NewKet Lens (Recherche par Image)
- Reconnaissance et appariement de photos d'articles avec la base produit via des modèles d'embeddings (Hugging Face / Vision).

---

## 🛠️ Stack Technologique

| Domaine | Technologies |
|---|---|
| **Frontend** | HTML5, CSS3 Moderne, Vanilla JS (ES Modules), TailwindCSS, PostCSS, Vite |
| **Mobile Hybride** | Capacitor 7, Swift 5.9, SwiftUI, WidgetKit (iOS 17/18+) |
| **Design System** | Apple Liquid Glass, SF Symbols, Micro-animations haptiques, Iconify |
| **Backend API** | Node.js (ESM), Express 5, Helmet, CORS, Express-Rate-Limit, Compression |
| **Base de Données** | Supabase (PostgreSQL 15), Row Level Security (RLS), Supabase Realtime |
| **Stockage & CDN** | Cloudinary CDN (redimensionnement automatique `w_200,h_200,c_fill,q_auto,f_jpg`) |
| **Paiements** | FlexPaie Gateway (M-Pesa, Orange Money, Airtel Money) |
| **Intelligence Artificielle** | Hugging Face Inference API, Vector Search / Embeddings |
| **Observabilité** | Sentry Node, Health checks intégrés |
| **Qualité & Tests** | Playwright (E2E), Vitest, Mojibake UTF-8 Tool |
| **CI / CD** | GitHub Actions (macOS arm64 runners, compilation IPA automatique) |

---

## ⚡ Démarrage Rapide

### Prérequis
- [Node.js](https://nodejs.org/) v18.0.0 ou supérieur
- [npm](https://www.npmjs.com/) v9.0.0 ou supérieur
- (Pour mobile iOS) macOS avec Xcode 15+ ou compte GitHub avec Actions activées

### 1. Installation des dépendances

À la racine du monorepo, exécutez la commande d'installation groupée :

```bash
npm run install:all
```

*Cette commande installe les dépendances à la fois pour le frontend et pour le backend.*

### 2. Configuration des variables d'environnement

Créez les fichiers d'environnement dans leurs dossiers respectifs :

```bash
# Frontend
cp frontend/.env.example frontend/.env

# Backend
cp backend/.env.example backend/.env
```

*(Consultez la section [Variables d'environnement](#-variables-denvironnement) pour les détails).*

### 3. Lancement en mode développement

Pour lancer l'ensemble des services en parallèle :

```bash
npm run dev
```

Ou individuellement dans deux terminaux séparés :

```bash
# Terminal 1 : Backend API (port 3000 ou 5000)
npm run dev:backend

# Terminal 2 : Frontend Vite (port 5173)
npm run dev:frontend
```

Accédez ensuite à l'application web sur `http://localhost:5173`.

---

## 🔐 Variables d'Environnement

### `frontend/.env`
| Variable | Description | Exemple |
|---|---|---|
| `VITE_SUPABASE_URL` | URL de votre instance Supabase | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clé publique anonyme Supabase (RLS actif) | `eyJhbGciOi...` |
| `VITE_API_BASE_URL` | URL de l'API backend | `http://localhost:5000/api` |

### `backend/.env`
| Variable | Description |
|---|---|
| `PORT` | Port d'écoute du serveur Express (défaut: `5000`) |
| `SUPABASE_URL` | URL de l'instance Supabase |
| `SUPABASE_SECRET_KEY` | Clé de service Supabase (Service Role) avec privilèges complets |
| `CLOUDINARY_CLOUD_NAME` | Identifiant du cloud Cloudinary |
| `CLOUDINARY_API_KEY` | Clé d'API Cloudinary |
| `CLOUDINARY_API_SECRET` | Clé secrète Cloudinary |
| `FLEXPAIE_API_KEY` | Clé API passerelle Mobile Money |
| `FLEXPAIE_MERCHANT_ID` | Identifiant marchand FlexPaie |
| `SENTRY_DSN` | DSN de monitoring Sentry |

> [!NOTE]
> En mode local sans clés FlexPaie configurées, les flux de test retournent automatiquement `PAYMENT_PROVIDER_NOT_CONFIGURED` tout en permettant la simulation des mécanismes de commande et d'escrow.

---

## 📱 Déploiement & CI/CD iOS

Le projet dispose d'un pipeline d'intégration continue GitHub Actions configuré dans `.github/workflows/ios-build.yml`.

### Compilation Automatique de l'IPA (Non signée)
1. Tout commit ou déclenchement manuel (`workflow_dispatch`) sur la branche `main` peut lancer le build :
   ```bash
   gh workflow run ios-build.yml --ref main
   ```
2. La CI exécute sur un runner macOS :
   - Installation des dépendances et build frontend Vite
   - Synchronisation Capacitor iOS (`npx cap sync ios`)
   - Compilation Xcode (`xcodebuild`) de l'application et de l'extension Widgets
   - Génération de l'archive et packaging de l'IPA (`NewKet.ipa`)
3. L'IPA finale est disponible dans les **Artifacts** de la release GitHub et peut être installée directement sur iPhone via **Sideloadly**, **AltStore** ou **TrollStore**.

---

## 🧪 Qualité & Scripts Utilitaires

| Commande | Rôle |
|---|---|
| `npm run build:frontend` | Compile le bundle frontend de production dans `frontend/dist/` |
| `npm run check:encoding` | Analyse récursive du projet pour bloquer tout problème d'encodage Mojibake (UTF-8) |
| `npm run fix:encoding` | Correction automatique des caractères mal encodés |
| `npm run test:e2e` | Exécution de la suite de tests de parcours utilisateur Playwright |
| `node --check backend/src/server.js` | Vérification de la syntaxe de l'API backend sans exécution |

---

## 👥 Conventions & Équipe

Consultez le document [`DECISIONS_EQUIPE_NEWKET.md`](DECISIONS_EQUIPE_NEWKET.md) pour retrouver l'ensemble des arbitrages stratégiques validés :
- Politique d'arbitrage 100% humaine sur les litiges
- Gestion des frais de transport et de retour
- Modèle d'absorption des frais Mobile Money
- Engagements de garanties vendeurs (24h / 48h / 72h)

---

<div align="center">
  <sub>Fait avec passion pour l'Afrique et la RDC 🇨🇩 • NewKet Team</sub>
</div>
