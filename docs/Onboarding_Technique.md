# Guide d'Onboarding Technique - Équipe NewKet

Bienvenue dans l'équipe technique de **NewKet** ! 🚀

Ce document a pour but de vous présenter l'architecture, les choix technologiques et les processus de développement de la plateforme afin de faciliter votre prise en main du projet.

---

## 1. Vue d'ensemble du Projet

**NewKet** est une plateforme e-commerce fullstack moderne structurée en **Monorepo**. Elle permet la mise en relation entre acheteurs et vendeurs avec un système de paiement sécurisé incluant un **séquestre de 72 heures**.

### Technologies Principales
*   **Frontend** : Vite, HTML/CSS/JS Vanilla, TailwindCSS
*   **Backend** : Node.js, Express.js
*   **Base de Données & Auth** : Supabase (PostgreSQL)
*   **Hébergement / CI-CD** : Vercel (Front) 
*   **Stockage Fichiers** : Cloudinary (Gestion des images via backend)
*   **Paiements** : FlexPaie (Mobile Money local CDF/USD) et Stripe (câblé côté code)

---

## 2. Structure du Monorepo

Le projet est organisé dans les dossiers suivants :

```text
NewKet/
├── frontend/   # Application client (Vite, TailwindCSS)
├── backend/    # API Express + logique métier (Routes, Webhooks, Cron)
├── database/   # Migrations et scripts Supabase
├── docs/       # Documentation du projet
├── scripts/    # Scripts utilitaires locaux (.mjs, .bat)
├── tests/      # Tests d'intégration et unitaires
└── tools/      # Outils divers pour le développement
```

---

## 3. Configuration et Démarrage Local

### Prérequis
*   Node.js (version 18+ recommandée)
*   Git

### Installation
Pour installer les dépendances de tout le projet (Front + Back) en une seule commande depuis la racine :
```bash
npm run install:all
```

### Lancement de l'environnement de développement
Ouvrez deux terminaux à la racine du projet :

1.  **Démarrer le Backend :**
    ```bash
    npm run dev:backend
    ```
2.  **Démarrer le Frontend :**
    ```bash
    npm run dev:frontend
    ```

*Note : Des scripts batch (`start_all.bat`, `start_frontend.bat`, `start_backend.bat`) sont également disponibles à la racine pour les utilisateurs Windows.*

---

## 4. Variables d'Environnement (.env)

Pour faire fonctionner le projet localement, vous devez configurer les fichiers `.env` dans les dossiers respectifs.

**Dans `frontend/.env` :**
*   `VITE_SUPABASE_URL` : URL de votre projet Supabase
*   `VITE_SUPABASE_ANON_KEY` : Clé publique Supabase

**Dans `backend/.env` :**
*   `SUPABASE_SECRET_KEY` : Clé secrète (Service Role) Supabase
*   **Paiement** : Clés API FlexPaie / Stripe
*   **SMTP** : Identifiants pour l'envoi d'emails (Nodemailer)
*   **Sentry** : Configuration pour le suivi des erreurs
*   **Cloudinary** : Clés pour l'upload d'images

*(Demandez au Lead Tech de vous fournir le fichier `.env` de développement sécurisé).*

---

## 5. Architecture de Paiement et Séquestre

La sécurité des transactions est le pilier de NewKet. Le système fonctionne ainsi :
1.  **Achat** : L'acheteur paie (via FlexPaie ou carte bancaire).
2.  **Séquestre** : L'argent est bloqué par le système avec un statut `DEFERRED_CLEARANCE`.
3.  **Livraison** : L'acheteur valide la réception de la commande.
4.  **Libération (Payout)** : Après un délai de **72 heures**, un *Cron Job* backend transfère automatiquement les fonds sur le compte marchand du vendeur.

*Note de développement : Tant que les clés API de paiement (Stripe/FlexPaie) ne sont pas renseignées en local, l’API retourne une erreur `PAYMENT_PROVIDER_NOT_CONFIGURED`, ce qui bloque proprement le flux de paiement lors de vos tests.*

---

## 6. Qualité du Code et Tests

Le projet intègre des outils de validation et de tests pour assurer la stabilité :

*   **Tests End-to-End (E2E)** : Utilisation de **Playwright** (`package.json` à la racine).
*   **Scripts de Tests** : Des scripts batch sont prêts pour exécuter les tests par modules (ex: `run_test_auth.bat`, `run_test_checkout.bat`, `run_tests_all.bat`).
*   **Validation Backend** : `node --check backend/src/server.js`
*   **Build Frontend** : `npm run build:frontend`

---

## 7. Prochaines Étapes pour vous
1. Clonez le dépôt GitHub (branche de développement).
2. Récupérez les variables d'environnement.
3. Lancez les serveurs en local.
4. Explorez les routes de l'API dans le dossier `backend/`.
5. Prenez connaissance des composants UI dans le dossier `frontend/`.

Bon code et bienvenue dans l'aventure **NewKet** !
