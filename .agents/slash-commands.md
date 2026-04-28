# Slash Commands Registry

Ce registre definit les commandes slash a utiliser pour piloter les workflows du projet.

## Active commands

### /commit-push

- Type: workflow
- Workflow file: `workflows/commit-push-workflow.md`
- Skill file: `skills/commit-push-pack.md`
- Rules file: `rules/commit-push-rules.md`
- Usage: verifie le diff, add, commit, puis push sur la branche courante

Prompt court :

`/commit-push`

Prompt libre :

`/commit-push commit et push mes changements avec un message clair`

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

### /performance-check

- Type: workflow
- Workflow file: `workflows/performance-check-workflow.md`
- Skill file: `skills/performance-fluid-ux-pack.md`
- Rules file: `rules/performance-fluid-ux-rules.md`
- Usage: audit performance/UX fluide d'une page/feature, reduction API calls, lazy loading, cache, images, performance percue

Prompt court :

`/performance-check`

Prompt libre :

`/performance-check analyse cette page/feature, detecte ce qui casse la fluidite (API calls, images, re-renders) et propose des optimisations concretes (ou implemente-les si je dis vas-y)`

### /scaling-check

- Type: workflow
- Workflow file: `workflows/scaling-check-workflow.md`
- Skill file: `skills/scalability-engine-pack.md`
- Rules file: `rules/scalability-engine-rules.md`
- Usage: verifier la scalabilite d'une feature (API stateless, DB load, pagination, indexes, cache, async/queue, cout)

Prompt court :

`/scaling-check`

Prompt libre :

`/scaling-check analyse l'impact scalabilite de cette feature (API/DB) et propose les actions minimales (pagination, indexes, cache, async) pour etre pret au scale`

### /system-check

- Type: workflow
- Workflow file: `workflows/system-check-workflow.md`
- Skill file: `skills/system-health-monitor-pack.md`
- Rules file: `rules/system-health-monitor-rules.md`
- Usage: supervision intelligente (perf, paiements, commandes, users, vendeurs) + rapport + priorites P0/P1/P2 + actions

Prompt court :

`/system-check`

Prompt libre :

`/system-check genere un rapport system health (P0/P1/P2) avec preuves et actions concretes`

### /encoding-check

- Type: workflow
- Workflow file: `workflows/encoding-check-workflow.md`
- Skill file: `skills/encoding-rendering-fixer-pack.md`
- Rules file: `rules/encoding-rendering-fixer-rules.md`
- Usage: detecte et corrige les problemes d'encodage (accents/symboles/emojis) et standardise le rendu (UTF-8 partout)

Prompt court :

`/encoding-check`

Prompt libre :

`/encoding-check scanne l'app, identifie les textes corrompus (Ã©, �), trouve la source (DB/API/frontend) et corrige en UTF-8 sans double encodage`
