# Slash Commands Registry

Ce registre definit les commandes slash a utiliser pour piloter les workflows du projet.

## Active commands

### /audit-ui

- Type: workflow
- Workflow file: `workflows/ui-ux-audit-workflow.md`
- Skill file: `skills/ui-ux-audit-pack.md`
- Rules file: `rules/ui-ux-audit-rules.md`
- Usage: audit UI/UX global, hierarchie visuelle, lisibilite, coherence, CTA, micro-interactions

Prompt court :

`/audit-ui analyse cette page`

Prompt libre :

`/audit-ui analyse cette interface comme un expert UI/UX senior et propose les corrections les plus importantes`

### /audit-responsive

- Type: workflow
- Workflow file: `workflows/responsive-audit-workflow.md`
- Skill file: `skills/responsive-audit-pack.md`
- Rules file: `rules/responsive-audit-rules.md`
- Usage: audit responsive, debordements, layout flexible, breakpoints, mobile navigation, interactions tactiles

Prompt court :

`/audit-responsive corrige cette page`

Prompt libre :

`/audit-responsive analyse et corrige tous les problemes responsive de cette interface`

### /dark-mode

- Type: workflow
- Workflow file: `workflows/dark-mode-workflow.md`
- Skill file: `skills/dark-mode-pack.md`
- Rules file: `rules/dark-mode-rules.md`
- Usage: implementation ou audit d'un mode sombre global, tokens de theme, contrastes, composants, switch persistant, flash prevention

Prompt court :

`/dark-mode implemente un mode sombre fiable sur cette page`

Prompt libre :

`/dark-mode implemente un mode sombre global, lisible et coherent avec switch persistant, prefers-color-scheme et correction des incoherences visuelles`
