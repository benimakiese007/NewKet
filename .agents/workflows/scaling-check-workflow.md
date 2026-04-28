# Scaling Check Workflow

Workflow: scaling-check

Ce workflow sert a evaluer l'impact scalabilite d'une feature (front, API, DB) et a proposer les adaptations minimales pour rester horizontal-scaling-ready.

## Etapes

1. Detecter l'impact de la feature (traffic, ecriture, lecture, temps reel)
2. Verifier la charge base de donnees (indexes, queries, pagination, N+1)
3. Identifier les bottlenecks (hot paths, endpoints, tables, locks)
4. Ajouter/ajuster le cache si necessaire (produits populaires, accueil, recherche)
5. Deporter les taches lourdes en async (queue: notifications, emails, logs, batch)
6. Confirmer le comportement stateless (pas d'etat serveur, tokens, sessions minimales)
7. Valider l'impact cout (DB egress, compute, cache hit-rate, quotas)

## Output attendu

- Risques de scalabilite (priorises P0/P1/P2)
- Actions concretes (index, pagination, cache, async, split)
- Si demande: implementation directe dans le code (smallest safe change)

