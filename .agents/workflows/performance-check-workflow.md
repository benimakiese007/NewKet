# Performance Check Workflow

Workflow: performance-check

Ce workflow sert a auditer rapidement une page ou une fonctionnalite et a appliquer des optimisations concretes pour une UX fluide.

## Etapes

1. Scanner la page ou la feature (front + appels API)
2. Detecter les operations lourdes (gros bundles, images, scripts, DOM)
3. Identifier les re-renders inutiles (etat global, listeners, reruns)
4. Optimiser les appels API (dedupe, regrouper, pagination, cache)
5. Compresser / convertir les assets (images, SVG, fonts si besoin)
6. Proposer et/ou appliquer des ameliorations (quick wins -> refactors)

## Output attendu

- Liste des problemes (priorises P0/P1/P2)
- Corrections proposees (concretes, patchables)
- Si demande: implementation directe dans le code (smallest safe change)

