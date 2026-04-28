# Workflow: Commit + Push (NewKet)

## Objectif

Publier proprement les changements locaux du repo NewKet : verifier l'etat, choisir un message de commit clair, commit, puis push sur la branche courante.

## Commande slash

`/commit-push`

## Entrees attendues

- Un court contexte (optionnel) : "fix responsive admin", "corrige accents", etc.
- Optionnel : message de commit explicite.

## Procedure (assistant)

1. Verifier la racine repo et l'etat git.
2. Inspecter le diff pour eviter de committer des changements accidentels.
3. Proposer un message de commit si l'utilisateur n'en donne pas.
4. `git add -A`
5. `git commit -m "<message>"`
6. `git push` (sur le remote par defaut) pour la branche courante.
7. Confirmer la branche et le resultat.

## Commandes PowerShell (reference)

- `git status --short`
- `git diff`
- `git add -A`
- `git commit -m "chore: commit"`
- `git push`

