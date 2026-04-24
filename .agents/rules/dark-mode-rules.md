# Dark Mode Rules

Ces regles cadrent toute implementation ou correction de mode sombre sur le projet.

## Regles

1. Strategie de theme globale
   Toujours remplacer les couleurs fixes par des variables, tokens ou couches de theme reutilisables avant d'ajouter des ajustements locaux.

2. Lisibilite et contrastes
   Toujours verifier que les contrastes restent confortables pour les textes, liens, placeholders, bordures et surfaces secondaires.

3. Hierarchie visuelle
   Toujours conserver une hierarchie nette entre titres, contenu principal, contenu secondaire et CTA. Aucun niveau d'information ne doit disparaitre en sombre.

4. Couverture des composants
   Toujours controler les composants majeurs : header, cartes, formulaires, modales, boutons, tableaux, menus, etats vides et messages systeme.

5. Etats interactifs
   Toujours definir des etats hover, focus, active, disabled, succes et erreur compatibles avec le sombre et clairement visibles.

6. Images, icones et logos
   Toujours traiter les medias qui deviennent agressifs ou illisibles en sombre. Ne pas laisser d'icones noires ou de fonds blancs non geres.

7. Theme systeme et persistance
   Toujours respecter `prefers-color-scheme` en absence de choix utilisateur et persister le switch manuel via local storage.

8. Chargement sans flash
   Toujours appliquer le theme avant le rendu initial afin d'eviter tout clignotement ou inversion visible au chargement.

9. Donnees dynamiques
   Toujours verifier que les contenus dynamiques et les donnees injectees heritent correctement des styles du theme.

10. Performance et verification
    Toujours privilegier une bascule legere, sans recalcul inutile, puis fournir un rapport clair des incoherences corrigees et des limites de verification.

## Prompt de reference

Implemente un mode sombre coherent et sans erreur sur toute ma plateforme. Garantit une lisibilite parfaite, remplace les couleurs par des variables, corrige tous les composants et etats, evite les clignotements, gere les images et icones et assure une experience fluide sur tous les ecrans.
