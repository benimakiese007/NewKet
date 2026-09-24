# 🛠 Guide d'Intégration Xcode : Live Activities & Dynamic Island

Ce document explique étape par étape comment finaliser l'intégration des Live Activities pour l'application NewKet. Tout le code (Javascript et Swift) est déjà écrit dans le projet. Il ne reste qu'à "brancher" le Widget dans Xcode.

---

## 🛑 Prérequis
1. Un Mac avec **Xcode 14.1** ou plus récent.
2. Un iPhone sous **iOS 16.1** minimum (ou le Simulateur iOS).
3. Avoir exécuté `npx cap sync ios` dans le dossier `frontend` avant d'ouvrir Xcode.

---

## 📝 Étape 1 : Ouvrir le projet
1. Ouvrez votre terminal, naviguez dans le dossier `frontend`.
2. Exécutez la commande : `npx cap open ios` (ou ouvrez manuellement `ios/App/App.xcworkspace` avec Xcode).

## 📝 Étape 2 : Lier les fichiers Swift à l'Application
Le code du plugin Capacitor a été généré, mais Xcode doit en être informé.
1. Dans le menu de navigation à gauche d'Xcode, faites un **Clic-droit sur le dossier jaune `App`** (sous la Target App).
2. Cliquez sur **"Add Files to App..."**.
3. Sélectionnez les 3 fichiers suivants (ils se trouvent dans le dossier `ios/App/App/`) :
   * `LiveActivityPlugin.swift`
   * `LiveActivityPlugin.m`
   * `OrderAttributes.swift`
4. Assurez-vous que la case **"Copy items if needed"** est DÉCOCHÉE et que la target **"App"** est COCHÉE, puis cliquez sur **Add**.

## 📝 Étape 3 : Créer la Target Widget (Le visuel de la Live Activity)
C'est cette étape qui permet à iOS d'afficher quelque chose sur l'écran verrouillé.
1. Dans la barre de menu tout en haut, allez dans **File > New > Target...**
2. Cherchez **"Widget Extension"** dans la barre de recherche et sélectionnez-le. Cliquez sur **Next**.
3. Remplissez les informations ainsi :
   * **Product Name** : `NewKetWidget`
   * **Include Live Activity** : ✅ **COCHEZ IMPÉRATIVEMENT CETTE CASE** (C'est ce qui active la Dynamic Island).
   * **Include Configuration Intent** : (Peut rester décoché).
4. Cliquez sur **Finish**.
5. Xcode va vous demander *"Activate “NewKetWidgetExtension” scheme?"*, cliquez sur **Activate**.

## 📝 Étape 4 : Partager les données entre l'App et le Widget
Le fichier `OrderAttributes.swift` contient la structure de données des commandes. Il doit être partagé entre votre application principale et le widget.
1. Dans le menu de gauche, cliquez sur le fichier `OrderAttributes.swift`.
2. Ouvrez le panneau de droite (Inspecteur - raccourci : `Cmd + Option + 0`).
3. Cherchez la section **"Target Membership"**.
4. ✅ **Cochez les DEUX cases** : `App` ET `NewKetWidgetExtension`.

## 📝 Étape 5 : Intégrer le Design (UI)
1. Xcode a généré un fichier nommé `NewKetWidgetLiveActivity.swift` dans le nouveau dossier de votre widget (à gauche).
2. Effacez tout le contenu de ce fichier généré par Apple.
3. Allez chercher le fichier `WidgetTemplate.swift` qui se trouve dans `frontend/ios/WidgetTemplate.swift` dans votre projet.
4. **Copiez tout le code** de `WidgetTemplate.swift` et **collez-le** dans le fichier `NewKetWidgetLiveActivity.swift` de Xcode.
5. (Optionnel) : Vous pouvez maintenant supprimer le fichier `WidgetTemplate.swift` de votre projet informatique, il ne sert plus à rien.

---

## 🚀 Tester sur Simulateur ou iPhone
C'est terminé ! 
1. Sélectionnez votre iPhone (ou un simulateur comme iPhone 15 Pro) en haut au centre d'Xcode.
2. Cliquez sur le gros bouton **"Play"** ▶️ (ou faites `Cmd + R`) pour compiler.
3. Depuis votre interface web (React/Vue/JS), déclenchez un appel au `LiveActivityManager` (par exemple un paiement).
4. **Magie** : Regardez la Dynamic Island s'animer ou verrouillez l'écran pour voir la carte de suivi de la commande !
