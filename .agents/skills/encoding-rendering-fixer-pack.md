# Encoding & Rendering Fixer (Pack)

## Objectif

Garantir que tous les textes (accents, symboles, langues, emojis) s'affichent correctement sur toute l'application.

Nom: `encoding-rendering-fixer`
Description: detecte et corrige les problemes d'encodage et de rendu des caracteres

## Problemes typiques a corriger

- `é` affiche en `Ã©`
- `è` affiche en `Ã¨`
- `à` affiche en `Ã `
- texte remplace par `?` ou des carres `☐`
- emojis non affiches
- caracteres invisibles (remplacement `�`)

## Regles fondamentales (obligatoires)

### 1) UTF-8 partout

- Frontend (HTML/CSS/JS) en UTF-8
- Backend (routes + templates) en UTF-8
- Base de donnees en UTF-8

HTML: chaque page doit contenir:

`<meta charset="UTF-8">`

### 2) Base de donnees correcte

- Postgres: `UTF8` (verification + collation adapte)
- MySQL/MariaDB: `utf8mb4` + collation `utf8mb4_unicode_ci` (ou equivalente)

### 3) API propre

Toutes les reponses JSON doivent etre servies avec:

`Content-Type: application/json; charset=utf-8`

### 4) Eviter les doubles encodages

Interdits (sauf raison explicite):

- encoder deux fois une meme valeur
- `encodeURIComponent` sur des textes qui doivent rester "human-readable"
- reparer du texte a l'affichage au lieu de corriger la source (DB / API / fichiers)

### 5) Fonts compatibles

- Utiliser des fonts modernes (Inter, Roboto, system-ui)
- Definir un fallback robuste (ex: `system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`)

## Cas special (tres frequent)

Si les donnees sont deja stockees avec un mauvais encodage, corriger le systeme ne suffit pas:

- Il faut nettoyer / reconvertir les donnees existantes

## Bonus: normalisation automatique

Ajouter une fonction de normalisation avant stockage/affichage:

- supprimer les caracteres de remplacement `�`
- refuser/alerter sur sequences evidemment corrompues (`Ã©`, `Ã¨`, etc.)
- normaliser Unicode (NFC) si besoin

