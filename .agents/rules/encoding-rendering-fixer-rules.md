# Rules: Encoding & Rendering Fixer

## Regles non-negociables

1) Toujours privilegier la correction a la source (DB/API/fichier) plutot qu'un contournement en UI.
2) Ne pas appliquer de transformation "magique" sur tous les textes si on n'a pas prouve la cause (risque de casser des donnees valides).
3) Toute correction doit etre verifiable: avant/apres sur un texte reel du produit.

## Checks obligatoires

- HTML: `<meta charset="UTF-8">` sur toutes les pages rendues
- API JSON: `Content-Type: application/json; charset=utf-8`
- Fichiers: encodage UTF-8 (sans BOM de preference)
- DB: encodage UTF8 (Postgres) / `utf8mb4` (MySQL)
- Fonts: fallback `system-ui` et compatibilite caracteres

## Anti-patterns a eviter

- Double encodage (encoder une valeur deja encodee)
- `decodeURIComponent` / `encodeURIComponent` utilise pour "reparer" du texte
- "Fixer" avec des remplacements massifs sans preuve (ex: remplacer tous les `Ã` aveuglement)

