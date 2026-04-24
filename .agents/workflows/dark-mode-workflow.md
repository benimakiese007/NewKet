# Dark Mode Workflow

Utilise ce workflow pour implementer ou auditer un mode sombre global de maniere fiable et cohente.

## Axes a couvrir

1. Strategie de theme globale
   Centralise les couleurs dans des tokens ou variables de theme. Supprime les couleurs fixes qui cassent la bascule clair/sombre.

2. Lisibilite et contrastes
   Verifie le contraste entre fond, texte, liens, placeholders, bordures et surfaces secondaires. Corrige toute perte d'information.

3. Hierarchie visuelle
   Maintiens une hierarchie claire pour les titres, textes, CTA, badges et contenus secondaires. Le sombre doit rester lisible et repose.

4. Couverture des composants
   Controle header, cartes, formulaires, modales, boutons, tableaux, menus, tooltips, loaders et etats vides. Corrige toute incoherence visuelle.

5. Etats interactifs
   Definis des styles adaptes pour hover, focus, active, disabled, succes, erreur et alertes afin que les interactions restent nettes en sombre.

6. Images, icones et logos
   Adapte les medias pour eviter les fonds blancs agressifs, les icones illisibles et les illustrations mal integrees.

7. Detection systeme et switch persistant
   Implemente `prefers-color-scheme` et un switch manuel persistant via local storage pour respecter le choix systeme et utilisateur.

8. Chargement sans flash
   Applique le theme avant le rendu initial avec un script inline minimal afin d'eviter tout flash visuel au chargement.

9. Cohabitation avec les donnees dynamiques
   Verifie que les contenus injectes depuis le backend ou des donnees runtime heritent bien des styles du theme.

10. Performance et validation
    Evite les recalculs lourds au switch, teste mobile/tablette/desktop et produis un rapport des incoherences corrigees.

## Contraintes techniques

- Utiliser des variables de theme pour les couleurs et surfaces.
- Respecter `prefers-color-scheme` tant qu'aucun choix utilisateur n'est stocke.
- Persister le choix manuel dans local storage.
- Appliquer le theme avant rendu pour eviter le flash.
- Ne jamais laisser un composant critique sans style dark explicite.

## Instruction de synthese

Implemente et optimise un mode sombre global sur ma plateforme avec une coherence visuelle totale. Assure une lisibilite optimale, remplace les couleurs fixes par des variables, corrige tous les composants et etats, gere les images et medias, evite les clignotements, respecte `prefers-color-scheme`, ajoute un switch manuel persistant et genere un rapport des incoherences corrigees.
