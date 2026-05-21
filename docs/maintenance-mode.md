# Mode maintenance (vérification local / prod)

## Comportement attendu

- **Frontend (site public)**: si `settings.maintenance_mode` (ou legacy `maintenanceMode`) est à `true`, les utilisateurs non-admin voient un écran “Maintenance”.
- **Backend (API)**: si maintenance est active, les requêtes **d’écriture** (`POST/PUT/PATCH/DELETE`) renvoient **503** (sauf admin). Les requêtes **GET** restent autorisées.

## Pré-requis

- Variables d’environnement:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (recommandé, surtout en prod si RLS protège `settings`)
- Pour tester une API distante: `API_URL` (ex: `https://newket.vercel.app`)

## Vérifier sans changer l’état (recommandé)

1) Lancer l’API (local ou prod) et s’assurer qu’elle répond.
2) Exécuter:

```bash
API_URL=http://127.0.0.1:3001 node backend/scripts/check-maintenance.js
```

- Si `DB maintenance enabled: true` alors le probe POST doit être `503`.
- Si `DB maintenance enabled: false` alors le probe POST ne doit pas être `503` (souvent `401` car endpoint protégé).

## Vérifier en activant/désactivant (attention prod)

Le script ci-dessous **toggle** la maintenance en base pendant le test:

```bash
API_URL=http://127.0.0.1:3001 node backend/scripts/test-security.js
```

En prod, utiliser ce script uniquement si tu acceptes un basculement maintenance très court.

