# Dark Mode UX + Fiabilite Pack

## 1. Strategie de theme globale

Implemente un mode sombre global coherent sur toute la plateforme. Remplace les couleurs fixes par des variables de theme reutilisables pour garantir une bascule propre entre clair et sombre.

## 2. Lisibilite et contrastes

Assure une lisibilite optimale entre textes, fonds, liens et elements d'interface. Corrige tout contraste insuffisant afin qu'aucune information ne disparaisse en sombre.

## 3. Hierarchie visuelle

Verifie que titres, corps de texte, meta-informations, badges et CTA gardent une hierarchie claire en mode sombre. Le sombre doit apaiser sans ecraser les niveaux de lecture.

## 4. Couverture des composants

Controle tous les composants critiques : header, cartes, formulaires, modales, boutons, tableaux, menus, tooltips et etats vides. Corrige les fonds trop clairs, textes invisibles et bordures absentes.

## 5. Etats interactifs

Adapte hover, focus, active, disabled, succes, erreur et alertes avec des couleurs compatibles avec le sombre. Les feedbacks doivent rester visibles et coherents.

## 6. Images, icones et logos

Traite les medias pour eviter les fonds blancs agressifs et les icones noires invisibles. Utilise des variantes dark, des fonds adaptes ou des filtres seulement quand c'est pertinent.

## 7. Detection systeme et switch persistant

Integre `prefers-color-scheme` pour respecter le theme systeme et ajoute un switch manuel persistant via local storage. L'utilisateur doit retrouver son choix sans surprise.

## 8. Chargement sans flash

Applique le theme avant le rendu initial avec un script inline minimal. Evite tout clignotement ou flash lors du chargement ou du changement de theme.

## 9. Donnees dynamiques et pages reelles

Verifie que les contenus injectes dynamiquement depuis le backend restent styles correctement en sombre. Controle la coherence sur toutes les pages, tous les ecrans et tous les etats reels.

## 10. Performance et rapport final

Optimise le switch de theme pour eviter les recalculs lourds. Termine par un rapport concis des incoherences corrigees et des points restants a verifier si besoin.

## Points techniques a imposer

```css
:root {
  --bg: #ffffff;
  --text: #111111;
  --card: #f5f5f5;
}

[data-theme="dark"] {
  --bg: #0f1115;
  --text: #e6e6e6;
  --card: #161a20;
}
```

```css
@media (prefers-color-scheme: dark) {
  :root {
    /* valeurs dark par defaut si pas de choix utilisateur */
  }
}
```

## Pieges frequents

- Texte gris sur fond gris
- Icones noires invisibles
- Images avec fond blanc non traite
- Inputs et formulaires mal styles
- Couleurs hardcodees qui ignorent le theme

## Version courte a reutiliser

Implemente un mode sombre coherent et sans erreur sur toute ma plateforme. Garantit une lisibilite parfaite, remplace les couleurs par des variables, corrige tous les composants et etats, evite les clignotements, gere les images et icones et assure une experience fluide sur tous les ecrans.
