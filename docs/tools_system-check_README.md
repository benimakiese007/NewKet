# System Check (System Health & Action Engine)

Commande locale pour generer un rapport "System Health Report" a partir des elements disponibles dans le repo (git, code scan, migrations).

## Run

Depuis la racine du repo :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/system-check/system-check.ps1 -Output system_health_report.md -SinceHours 24
```

## Notes

- Sans logs prod / DB live, le rapport reste partiellement "best-effort".
- Quand tu veux des preuves reelles (paiements/commandes), donne access Supabase (ou export) et on branche une version SQL/metrics.

