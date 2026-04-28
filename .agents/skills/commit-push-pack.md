# Skill Pack: Commit + Push (NewKet)

## Quand l'utiliser

Utilise ce pack quand l'utilisateur demande : "commit et push", "commi et push", "add commit and push", "vas-y publie".

## Regles

- Toujours verifier `git status --short` et `git diff` avant de committer.
- Ne pas creer de branche ni de PR sauf demande explicite.
- Ne pas inclure de secrets dans un commit.
- Utiliser PowerShell avec `;` pour enchainer.

## Checklist rapide

1. `git status --short`
2. `git diff`
3. Message de commit (si absent, proposer un message court et clair)
4. `git add -A`
5. `git commit -m "..."`
6. `git push`

