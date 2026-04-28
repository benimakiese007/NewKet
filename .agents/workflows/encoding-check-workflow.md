# Workflow: encoding-check

Objectif: detecter puis corriger les problemes d'encodage et de rendu des textes sur toute l'app (frontend + backend + base de donnees).

## 1) Scan UI text output

- Relever les textes visibles qui contiennent: accents, apostrophes typographiques, guillemets, symboles, emojis
- Identifier les patterns de corruption: `Ã`, `�`, `â€™`, `â€œ`, `â€`, `?` a la place d'accents

## 2) Detect corrupted characters

- Localiser les sources dans le repo (pages HTML, JSON, seed, templates, scripts)
- Distinguer "texte source corrompu" vs "rendu corrompu"

## 3) Verifier la source (DB / API / frontend)

- Frontend: presence de `<meta charset="UTF-8">` + fichiers en UTF-8 reele
- Backend: headers `Content-Type` avec charset
- DB: charset/collation (Postgres UTF8 / MySQL utf8mb4)

## 4) Normaliser tout en UTF-8

- Ajuster les headers backend si necessaire
- Verifier les pages HTML sans meta charset
- Verifier que les fichiers sources sont bien sauvegardes en UTF-8

## 5) Remplacer les sequences cassees

- Corriger a la source: contenu (HTML/JSON/DB)
- Eviter les "patchs visuels" qui masquent la corruption

## 6) Valider le rendu

- Tester l'affichage sur plusieurs pages
- Verifier mobile + desktop
- Verifier au moins: accents FR, symboles, emojis, guillemets typographiques

Sortie attendue:
- Liste des fichiers / tables / routes corrigees
- Checklist "UTF-8 partout" verifiee

