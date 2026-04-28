# System Health Monitor Rules (NEWKET)

## But

Detecter vite, prouver (evidence), puis proposer des actions concretes.

## Sources a privilegier (ordre)

1) Logs runtime (backend + frontend)
2) Erreurs API (4xx/5xx) et endpoints les plus appeles
3) DB / contraintes (statuts incoherents, rows orphelines)
4) Perf percue (chargement, assets, TTFB) + perf reelle (API)

## Evidence obligatoire

Chaque incident doit contenir au moins 1 preuve :

- un extrait de log (timestamp + signature)
- un endpoint + status code + payload shape (sans secrets)
- une requete SQL/diagnostic et son resultat (si applicable)
- une mesure perf (ms, taille asset, nombre de requetes)

## Regles de priorite (P0/P1/P2)

- P0 (🔴 Critique)
  - argent bloque / paiements incoherents
  - commandes bloquees / livraisons cassees
  - corruption de data, erreurs 500 repetitives sur parcours cle
  - securite / fuite de donnees / auth bypass

- P1 (🟠 Important)
  - UX degradee (checkout, paiement, login) sans blocage total
  - hausse d'erreurs 4xx/5xx mais non systemique
  - vendeurs impactes (retards, disputes) a grande echelle

- P2 (🟡 Amelioration)
  - optimisations perf, cleanup, refactors, instrumentation
  - warnings et dette technique sans impact immediate

## Actions

Chaque incident doit proposer :

- Action immediate (quick win, reversible, safe)
- Action robuste (solution durable, peut prendre plus de temps)
- Owner propose (backend / frontend / db / ops)

## Rapport (template)

Titre : System Health Report - YYYY-MM-DD

- Scope : (prod / staging / local) + pages/features concernees
- Sources : logs, endpoints, tables, commits (si applicable)

Sections :

1) Resume executif
2) Incidents P0
3) Incidents P1
4) Ameliorations P2
5) Backlog et prochaines verifs

