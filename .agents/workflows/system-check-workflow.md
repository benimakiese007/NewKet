# System Health Monitor Workflow

Workflow: system-check

Ce workflow sert a superviser NEWKET et generer un rapport actionnable.

## Etapes

1. scan system metrics (performance + erreurs + transactions)
2. detect anomalies (seuils, deltas, patterns repetitifs)
3. classify issue (low / medium / critical)
4. generate action suggestion (1 action principale + 1 fallback)
5. assign priority (P0/P1/P2)
6. log issue (rapport + backlog)

## Regles de classification

- Critical = P0 = argent/commandes bloques, corruption de data, securite
- Medium = P1 = impact utilisateur (UX/erreurs), pertes partielles
- Low = P2 = optimisation / dette / hygiene

## Output attendu

- Rapport "System Health Report" (date, scope, sources inspectees)
- Liste d'incidents priorisee (P0 -> P2)
- Actions proposees (directes, patchables)
- Si le user dit "vas-y": appliquer les fixes safe/high-confidence

## Commande locale (repo)

Depuis la racine :

`powershell -NoProfile -ExecutionPolicy Bypass -File tools/system-check/system-check.ps1 -Output system_health_report.md -SinceHours 24`
