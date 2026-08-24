# NewKet

Plateforme e-commerce fullstack organisée en monorepo.

## Structure

```text
NewKet/
├── frontend/   # Vite + HTML/CSS/JS
├── backend/    # API Express + logique métier
├── database/   # Migrations Supabase
├── docs/       # Documentation projet
└── tools/      # Scripts utilitaires locaux
```

## Démarrage

```bash
npm run install:all
npm run dev:backend
npm run dev:frontend
```

## Variables importantes

- `frontend/.env` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `backend/.env` : `SUPABASE_SECRET_KEY`, SMTP, Sentry

- Tant que les clés FlexPaie ne sont pas renseignées, l’API retourne `PAYMENT_PROVIDER_NOT_CONFIGURED`.
- La libération d’escrow continue de fonctionner, mais le payout vendeur reste manuel jusqu’à l’activation des clés payout/provider.

## Validation locale

- Build frontend : `npm run build:frontend`
- Vérification syntaxe backend : `node --check backend/src/server.js`
