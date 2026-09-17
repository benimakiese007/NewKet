# Guide de Gestion des Secrets et du `.gitignore`

Ce document résume les bonnes pratiques pour la gestion des fichiers sensibles et l'utilisation du `.gitignore` au sein de l'équipe NewKet.

## ⚠️ Le principe de base

Ce n'est pas parce qu'un fichier est dans le `.gitignore` qu'il est sans importance. En réalité, les fichiers ignorés se divisent en deux catégories :

### 🟢 Catégorie 1 : Les fichiers Générables (Peuvent être supprimés)
Fichiers créés automatiquement par la machine ou les outils. Si supprimés, ils peuvent être recréés facilement.
- `node_modules/` (recréé via `npm install`)
- `dist/` (recréé via `npm run build`)
- `.DS_Store` / `.vscode/` (liés à l'OS ou à l'IDE)

### 🔴 Catégorie 2 : Les fichiers Vitaux (Ne PAS supprimer sans sauvegarde)
Ces fichiers sont ignorés **pour les cacher d'Internet**, mais le code en a absolument besoin pour fonctionner en local.
- `.env`, `.env.local`, `.env.production`
- `.secrets`

👉 **En cas de changement d'ordinateur**, ces fichiers ne seront PAS sur GitHub. Il faut impérativement les sauvegarder (sur un Drive sécurisé, un gestionnaire de mots de passe, etc.) avant de changer de PC.

---

## ❓ Pourquoi la base de données et le backend ont besoin du `.env` ?

Le fichier `.env` est le **trousseau de clés** de l'application.

- **Base de données :** Le code y cherche `DATABASE_URL` pour savoir où se connecter et avec quel mot de passe.
- **Plateformes externes (Stripe, API, etc.) :** Le code y cherche les clés API (ex: `STRIPE_API_KEY`) pour prouver qu'il a le droit de faire des actions.

En production (ex: sur Vercel), il n'y a pas de fichier `.env`. On copie/colle directement ces secrets dans le dashboard de l'hébergeur.

---

## 👥 Comment faire quand on travaille en équipe (ex: 10 développeurs) ?

On ne pousse **JAMAIS** le `.env` sur GitHub. Voici comment procèdent les équipes pros :

1. **Le fichier `.env.example`** : On laisse sur GitHub un fichier avec les noms des clés, mais vide. Cela sert de "mode d'emploi" pour les nouveaux venus.
2. **Le partage sécurisé** : Les vrais mots de passe sont partagés via un outil sécurisé (coffre-fort d'équipe comme Bitwarden, 1Password, ou un outil de gestion d'environnement comme Vercel / Doppler).
3. **Chacun son environnement** : Bien souvent, chaque développeur aura des valeurs légèrement différentes dans son propre `.env` (par exemple, une base de données de test par développeur) pour ne pas se marcher sur les pieds.
