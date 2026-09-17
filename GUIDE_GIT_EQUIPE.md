# 🚀 Guide de Travail en Équipe (Workflow Git)

Ce document explique les règles de base à suivre pour que toute l'équipe de développement puisse travailler sur NewKet en même temps, sans écraser le code des autres.

## ⚠️ La Règle d'Or
**On ne code JAMAIS directement sur la branche `main`.** 
La branche `main` est sacrée : elle contient le code stable qui va en production. Chaque développeur doit travailler dans son propre "bac à sable" appelé une **branche**.

---

## 🛠️ Le Workflow (Les commandes au quotidien)

### 1. Avant de coder : Mettre à jour son PC
Au début de chaque journée, récupérez toujours le travail que les autres ont validé la veille.
```bash
git checkout main
git pull origin main
```

### 2. Démarrer une nouvelle tâche : Créer une branche
Créez une branche isolée pour votre fonctionnalité ou votre correctif. Utilisez un nom clair :
- `feat/...` (pour une nouvelle fonctionnalité)
- `fix/...` (pour corriger un bug)
```bash
# Exemple pour le développement du panier
git checkout -b feat/systeme-panier
```
*À partir de là, vous êtes dans votre espace sécurisé. Rien de ce que vous faites ne cassera le code des autres.*

### 3. Sauvegarder son travail : Les Commits
Faites des petits commits clairs et réguliers.
```bash
git add .
git commit -m "feat: ajout du bouton ajouter au panier"
```

### 4. Envoyer son travail sur Internet : Le Push
Une fois votre fonctionnalité terminée, envoyez votre branche sur le GitHub de l'équipe :
```bash
git push origin feat/systeme-panier
```

### 5. Valider et Fusionner : La Pull Request (PR)
1. Allez sur le site de GitHub.
2. Cliquez sur le bouton pour créer une **Pull Request**.
3. Demandez à un collègue de vérifier votre code (Code Review).
4. Si tout est bon, on clique sur "Merge" : votre code rejoint enfin la branche `main` !

---

## 🚨 Que faire en cas de Conflit de Fusion (Merge Conflict) ?

Un conflit arrive si Alice et Bob modifient tous les deux exactement la même ligne dans le même fichier. Pas de panique, Git bloque tout pour éviter la casse :

1. Votre éditeur de code (VS Code) va afficher les deux versions (la vôtre et celle de l'autre développeur).
2. Cliquez sur `Accept Current Change` (garder le vôtre), `Accept Incoming Change` (garder celui de l'autre), ou modifiez le texte à la main pour garder les deux.
3. Une fois résolu, validez la réparation :
```bash
git add .
git commit -m "fix: résolution des conflits"
```
