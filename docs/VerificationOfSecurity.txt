# Règles de sécurité - OBLIGATOIRES

## Secrets & Clés API
- JAMAIS de clé API, token, ou mot de passe en dur dans le code
- TOUS les secrets vont dans un fichier .env.local (jamais commité)
- Le fichier .env doit être dans le .gitignore AVANT le premier commit
- Côté client (React, Next, etc.) : utiliser UNIQUEMENT les variables préfixées correctement (NEXT_PUBLIC_, VITE_, etc.)
- Côté serveur : les clés sensibles (Stripe secret, Supabase service key) ne sont JAMAIS exposées au frontend

## Base de données (Supabase / Firebase)
- Row Level Security (RLS) ACTIVÉ sur TOUTES les tables sans exception
- Chaque table a au minimum 1 policy SELECT, 1 UPDATE, 1 DELETE
- Policy par défaut = RESTRICTIVE (tout est bloqué sauf ce qui est explicitement autorisé)
- Utiliser UNIQUEMENT auth.uid() dans les policies (JAMAIS user_metadata, l’utilisateur peut le modifier)
- La service key Supabase = BACKEND UNIQUEMENT, jamais dans le code client
- En client-side, utiliser UNIQUEMENT la anon key
- Ajouter WITH CHECK sur toutes les policies UPDATE et INSERT
- Créer un index sur user_id pour chaque table avec RLS

## Authentification
- Toute page protégée redirige vers /login si l’utilisateur n’est pas connecté
- Les tokens JWT sont validés côté serveur, pas uniquement côté client
- Le logout invalide la session complètement (pas juste un redirect)
- Les cookies de session : Secure, HttpOnly, SameSite=Strict
- Implémenter un refresh token avec expiration courte (15 min access, 7 jours refresh)

## Inputs utilisateur (injections)
- JAMAIS de concaténation directe dans les requêtes SQL → parameterized queries
  ❌ db.query("SELECT * FROM users WHERE id = " + userId)
  ✅ db.query("SELECT * FROM users WHERE id = $1", [userId])
- JAMAIS de innerHTML ou dangerouslySetInnerHTML avec du contenu utilisateur
- Valider ET sanitizer chaque input côté serveur (pas seulement côté client)
- Échapper tout output affiché dans le HTML

## API & Réseau
- HTTPS obligatoire en production (jamais HTTP)
- CORS restreint : lister les domaines autorisés explicitement
  ❌ Access-Control-Allow-Origin: *
  ✅ Access-Control-Allow-Origin: https://monapp.com
- Rate limiting sur les endpoints sensibles (login, signup, paiement)
- Pas de secrets dans les URLs (?apiKey=xxx → interdit)

## Dépendances & Packages
- Vérifier chaque package ajouté par l’IA dans package.json AVANT de commit
- Lancer npm audit (ou pip audit) régulièrement
- Se méfier des packages peu connus ou récents suggérés par l’IA
- Pas de eval(), pas de Function(), pas d’exécution dynamique de code

## Déploiement
- Variables d’environnement configurées dans le dashboard d’hébergement
- Le fichier .env n’est PAS dans le repo Git
- Tester le parcours complet en staging avant production
- Vérifier qu’aucune erreur n’affiche de stack trace en production
- Headers de sécurité : Content-Security-Policy, X-Frame-Options, Strict-Transport-Security