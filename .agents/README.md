# Agent Commands

Ce dossier contient les packs de travail reutilisables du projet :

- `skills/` pour les capacites et checklists
- `workflows/` pour les procedures d'execution
- `rules/` pour les contraintes et standards

## Slash commands

Utilise ces commandes dans tes messages pour appeler rapidement un workflow :

- `/audit-ui` -> charge le workflow `workflows/ui-ux-audit-workflow.md`
- `/audit-responsive` -> charge le workflow `workflows/responsive-audit-workflow.md`
- `/dark-mode` -> charge le workflow `workflows/dark-mode-workflow.md`
- `/performance-check` -> charge le workflow `workflows/performance-check-workflow.md`

## Usage

Exemples :

- `/audit-ui analyse cette page`
- `/audit-responsive corrige le responsive de cette vue`
- `/dark-mode implemente un mode sombre fiable sur cette page`
- `/performance-check audite cette page et optimise la fluidite`

La commande sert de raccourci conversationnel. Le mapping de reference est defini dans `slash-commands.md`.
