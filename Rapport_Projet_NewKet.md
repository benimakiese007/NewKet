# Rapport d'Avancement - Projet NewKet

**Période :** Depuis le début du projet à ce jour.
**Objectif du document :** Présenter les réalisations accomplies sur la plateforme NewKet pour l'ensemble des membres du groupe.

---

## 1. Vue d'Ensemble du Projet
NewKet est une véritable **Marketplace** (place de marché) complète que nous construisons de A à Z, permettant à différents vendeurs de proposer leurs produits. L'objectif principal a été de mettre en place des fondations solides pour permettre la publication de produits, la gestion des commandes et un système de paiement sécurisé.

## 2. Ce qui a été accompli (Les fondations)

### L'Interface Utilisateur (Ce que voit le client)
- **Design et Navigation :** Nous avons créé une interface fluide et agréable, avec une attention particulière sur la navigation (menus, barre de recherche, pied de page). Récemment, nous avons amélioré le design pour qu'il réagisse comme une vraie application mobile (retrait des longs appuis, menus latéraux adaptés).
- **Parcours Utilisateur :** Les pages clés sont en place, y compris la page produit, la page boutique du vendeur, et une belle section d'accueil (Hero section).

### Le Moteur de la Plateforme (Ce qui se passe en coulisses)
- **Base de données robuste :** Mise en place de toute l'architecture pour stocker de manière sécurisée les utilisateurs, les produits, et les commandes.
- **Gestion des Commandes :** Les vendeurs peuvent suivre et gérer leurs commandes de manière fiable, avec une sécurité stricte sur qui peut voir quoi.
- **Communication :** Configuration d'un système d'envoi d'emails (via l'adresse officielle de NewKet) pour communiquer avec les utilisateurs.

## 3. Les Trois Profils Utilisateurs

Pour faire fonctionner cette Marketplace, nous avons développé **trois espaces de gestion (dashboards)** distincts, adaptés aux besoins de chaque type d'utilisateur :

### L'Espace Acheteur (Client)
C'est l'interface dédiée aux clients qui viennent faire leurs achats.
- **Suivi des commandes :** Pour voir l'état d'avancement des achats en cours et l'historique.
- **Favoris :** Pour sauvegarder les produits qui les intéressent.
- **Vérification de factures :** Accès sécurisé aux factures des achats précédents.
- **Paramètres :** Gestion du profil, des adresses de livraison et des mots de passe.

### L'Espace Vendeur (Marchand)
C'est le centre de contrôle pour ceux qui vendent sur NewKet. Il comprend des outils professionnels pour :
- **Gestion du catalogue :** Une page dédiée pour publier de nouveaux articles (`publish`), définir les prix et gérer les stocks.
- **Gestion des commandes clients :** Pour accepter, préparer et expédier les commandes reçues.
- **Suivi financier :** Pour voir les revenus générés, les paiements en attente (via le système de séquestre) et demander des virements.
- **Personnalisation de la boutique :** Pour configurer l'apparence et la description de leur espace de vente.

### L'Espace Administrateur
C'est la tour de contrôle de la plateforme, réservée à l'équipe interne.
- **Modération et Certification :** Validation (ou refus) des nouveaux vendeurs pour garantir la qualité de la plateforme.
- **Surveillance du système :** Vue d'ensemble sur l'état de santé de la plateforme (`system health`).
- **Gestion globale :** Accès à la liste de tous les utilisateurs, à toutes les transactions et intervention en cas de litige.

## 4. Fonctionnalités Clés de la Plateforme

### Découverte des Produits et Boutiques
- **Catalogue Général :** Une page regroupant tous les produits disponibles sur la Marketplace, avec la possibilité de filtrer et de parcourir les articles facilement.
- **Page Boutique Individuelle :** Chaque vendeur certifié dispose d'un profil public visible par tous les acheteurs, présentant sa boutique, sa description et ses produits.
- **Annuaire des Boutiques :** Une page listant l'ensemble des boutiques actives sur la plateforme, permettant aux acheteurs de découvrir de nouveaux vendeurs.

### Communication et Support
- **Notifications Toast (Pop-up) :** Des messages visuels qui apparaissent brièvement à l'écran en temps réel pour informer l'utilisateur d'une action immédiate. Par exemple : confirmation d'une commande, alerte de baisse de prix sur un article favori, ou erreur de connexion.
- **Centre de Notifications (In-App) :** Un espace dédié regroupant l'historique complet de toutes les notifications. L'utilisateur peut filtrer (Toutes / Non lues / Alertes), marquer tout comme lu ou effacer l'historique.
- **Notifications Push (Appareil) :** Un système de notifications push déjà intégré dans le code, permettant d'alerter l'utilisateur même lorsqu'il n'est pas en train d'utiliser l'application, directement sur son téléphone ou ordinateur.
- **Page Support :** Un espace permettant aux utilisateurs de contacter directement l'équipe NewKet en cas de problème.
- **FAQ :** Une page de questions fréquentes pour aider les utilisateurs à trouver des réponses rapidement sans avoir à contacter le support.

### Marketing
- **Promotions et Codes Promo :** Un système de codes promotionnels permettant d'offrir des réductions aux acheteurs lors de campagnes marketing ou d'événements spéciaux.
- **Système de Parrainage (NKToken) :** Chaque utilisateur inscrit sur NewKet reçoit un **code de parrainage unique** qu'il peut partager librement et sans limite. Voici la logique complète :
  - Le parrain partage son lien de parrainage au format officiel : **`https://newket.cd/?ref=SONCODE`**
  - Si ce filleul complète une commande **dans les 30 jours suivant son inscription**, le parrain reçoit **1 NKToken (= 0,50 USD)** en récompense.
  - Si le filleul ne commande pas dans ce délai de 30 jours, le parrainage expire pour cette personne.
  - Les NKTokens accumulés sont utilisables **uniquement comme réduction sur les prochaines commandes** du parrain.
  - Il n'y a **aucune limite** de parrainages : plus on parraine, plus on accumule. Par exemple, 10 filleuls actifs = 10 NKTokens = **5 USD de réduction**.
  - L'espace Admin dispose d'un tableau de bord complet : classement des meilleurs parrains, historique des récompenses et total de NKTokens émis sur la plateforme.
  - Dans le dashboard de l'acheteur, chaque utilisateur peut voir son code, copier son lien, consulter son solde NKToken en temps réel et suivre l'historique de ses récompenses.

  > *Point technique accompli : la règle d'expiration automatique à 30 jours est opérationnelle côté backend.*

## 5. Connexion et Inscription
- **Choix du Rôle :** Dès l'inscription, l'utilisateur choisit son profil : **Acheteur** ou **Vendeur**. Ce choix détermine l'espace auquel il aura accès sur la plateforme.
- **Méthodes d'authentification actuelles :**
  - **Email :** Opérationnel. Les utilisateurs peuvent s'inscrire et se connecter en toute sécurité avec leur adresse email.
  - **Nom d'utilisateur :** Opérationnel. Connexion possible via le nom d'utilisateur choisi.
  - **Numéro de téléphone :** *Actuellement en cours de développement, non opérationnel pour le moment.*
- **L'authentification par SMS/Téléphone (Payant à l'usage) :**
  C'est ici qu'il y a un coût, car l'envoi de SMS passe par les réseaux télécoms mondiaux. Le paiement se fait au fournisseur de SMS (comme Twilio ou MessageBird) sur un modèle de Paiement à l'usage (Pay-As-You-Go) : on ne paie que ce que l'on consomme.
  - **La location du numéro de téléphone (optionnel mais souvent requis) :** Environ 1 € à 2 € par mois pour louer un numéro virtuel qui servira d'expéditeur.
  - **Le prix par SMS envoyé :** Le prix varie énormément selon le pays où vit l'utilisateur qui demande le code OTP. Par exemple (tarifs Twilio) :
    - États-Unis / Canada : ~0,008 € par SMS (moins de 1 centime !)
    - France / Europe : ~0,06 € par SMS
    - Pays d'Afrique : ~0,05 € à 0,15 € par SMS (les réseaux africains sont souvent plus chers).
  - **Exemple pratique pour la France :** Si 100 nouveaux utilisateurs s'inscrivent par mois via téléphone, cela coûtera environ 6 € pour les SMS de bienvenue.
- **Onboarding Vendeur (Guide de configuration) :** Un processus guidé en 2 étapes pour qu'un nouveau vendeur configure correctement sa boutique avant de pouvoir vendre :
  - **Étape 1 — Boutique :** Nom de la boutique, numéro de téléphone, localisation, description, mode de paiement préféré, logo et photo de vitrine.
  - **Étape 2 — Documents KYC :** Le vendeur soumet ses documents d'identité (CNI ou passeport), son registre de commerce (si disponible) et un justificatif de localisation. Une fois le dossier soumis, l'**Admin valide ou refuse** la certification.

## 6. Le Système de Paiement (Séquestre)
C'est un des plus gros chantiers techniques que nous avons réalisé. Pour protéger à la fois l'acheteur et le vendeur, nous avons mis en place un système de **Séquestre (Escrow)**. Voici le flux exact :
1. **Commande :** L'acheteur passe commande en sélectionnant son produit et en renseignant les informations nécessaires (quantité, adresse de livraison, et coordonnées de contact).
2. **Devis :** Le vendeur est notifié de la commande, l'analyse, et établit un devis définitif (incluant les frais de livraison, une note explicative, et la durée de livraison).
3. **Paiement (Payin / Séquestre) :** L'acheteur accepte le devis et procède au paiement (**Payin**). Son argent n'est pas envoyé directement au vendeur, il est sécurisé par le compte marchand dans FlexPaie.
4. **Livraison et Garantie :** Le vendeur expédie le colis. À la réception, l'acheteur valide la livraison en fournissant un code OTP (mot de passe à usage unique). Même après cette validation, **l'argent reste bloqué sur le compte marchand dans FlexPaie jusqu'à l'expiration de la garantie du produit**. C'est une fois ce délai écoulé que les fonds sont définitivement libérés pour le vendeur.

Ce système garantit la confiance : l'acheteur sait qu'il peut être remboursé s'il ne reçoit rien, et le vendeur sait que l'argent est déjà sécurisé avant d'expédier la marchandise.

**Exemple concret de calcul des commissions :**
Imaginons un devis validé à **100 USD** (prix du produit + livraison).
- Lors du **Payin**, une commission de **2,5%** (soit 2,50 USD) est appliquée par l'agrégateur.
- L'argent est conservé en sécurité pendant l'expédition et la période de garantie.
- Lors du **Payout** (déblocage vers le vendeur), une commission de **2%** (soit 2 USD) est appliquée.
- Le vendeur reçoit donc sur son compte : **95,50 USD** nets.

## 7. FlexPaie — L'Agrégateur de Paiement
**FlexPaie** est un agrégateur de paiement congolais, c'est-à-dire une plateforme qui regroupe plusieurs moyens de paiement en une seule intégration technique.

**Un seul compte marchand pour tout :** Seule l'administration de NewKet possède un compte marchand FlexPaie. Les vendeurs n'ont aucune démarche à faire de leur côté, ce qui simplifie énormément leur expérience sur la plateforme.

**6 moyens de paiement acceptés :**
- **M-Pesa** (Vodacom)
- **Airtel Money**
- **Orange Money**
- **Afrimoney**
- **Visa**
- **MasterCard**

**Pourquoi ce choix ?** Deux raisons majeures :
1. **Les frais :** 2,5% sur le Payin et 2% sur le Payout. Des frais compétitifs pour un service aussi complet.
2. **La confiance :** FlexPaie bénéficie d'un **partenariat officiel avec la Banque Centrale du Congo (BCC)**. Ce partenariat est un gage de sérieux et de légitimité qui inspire naturellement confiance aux utilisateurs de la plateforme.

**Prérequis pour l'activation du compte marchand :**
Pour obtenir l'accès officiel à l'API FlexPaie et signer l'accord de partenariat, NewKet doit fournir les documents juridiques de l'entreprise, à savoir :
- **RCCM** (Registre du Commerce et du Crédit Mobilier)
- **Identification Nationale** du représentant légal
- **NIF** (Numéro d'Identification Fiscale)
- **Statuts de la société**
- **100 USD** de frais d'activation

Une fois ces éléments fournis et l'accord signé, FlexPaie nous remettra l'ensemble des **clés API** et la documentation technique complète pour intégrer tous les moyens de paiement.

## 8. La Gestion des Litiges
Pour garantir un environnement sain et sécurisé, la Marketplace intègre un système robuste de résolution des problèmes :
Deux situations peuvent se présenter :

1. **Le vendeur n'a pas encore expédié le colis :**
   Si l'acheteur a déjà payé mais que le vendeur n'a toujours pas initié la livraison, la commande est annulée et l'argent est **retourné automatiquement à l'acheteur sans aucune discussion ni intervention.**

2. **La livraison a commencé ou est terminée :**
   Si un problème survient après expédition (produit non conforme, non reçu, ou cassé), l'acheteur peut signaler un **litige** avant la fin de la période de garantie. Dans ce cas :
   - **Gel des fonds :** L'argent reste bloqué en toute sécurité sur le compte marchand Flexpaie de la plateforme.
   - **Intervention de l'Admin :** L'équipe administrative de NewKet analyse la situation (preuves, discussions) via son espace dédié.
   - **Résolution :** L'Admin tranche le litige. L'argent est alors soit remboursé à l'acheteur, soit débloqué pour le vendeur, selon la décision finale. **Important : Quelle que soit l'issue du litige, les commissions de fonctionnement (Payin et Payout) sont toujours prélevées par l'agrégateur.**

## 9. Prévisions Budgétaires (Infrastructures)

Pour anticiper la mise en production commerciale de la Marketplace, voici les coûts d'infrastructure technique à prévoir. Ce sont des coûts incompressibles mais très optimisés :

- **Nom de domaine (newket.market) : ~50$ / an**
  L'achat de l'adresse officielle du site (`newket.market`) est indispensable pour l'identité de la plateforme et le professionnalisme. Ce montant (qui inclut généralement les frais ICANN et éventuellement un certificat SSL standard) est à régler annuellement.
- **Hébergement (Vercel) : ~20$ / mois**
  Bien que le plan gratuit ("Hobby") soit techniquement suffisant pour faire tourner le site actuellement, les conditions de Vercel interdisent strictement l'usage de ce plan gratuit pour un projet commercial. Le passage au plan "Pro" est donc obligatoire pour le lancement.
- **Base de données (Supabase) : ~25$ / mois**
  C'est le moteur qui fait tourner nos données et notre système d'authentification. L'avantage est que le plan gratuit est très généreux. Nous n'aurons besoin de passer au plan payant de 25$ que lorsque la plateforme dépassera la barre des 10 000 utilisateurs.
- **Système d'Emailing (Brevo) : 9$ à 18$ / mois (ultérieurement)**
  Le plan gratuit actuel (300 emails/jour) est suffisant pour démarrer. L'abonnement payant (Starter à partir de 9$/mois ou Standard à partir de 18$/mois) sera nécessaire uniquement lorsque le volume d'utilisateurs augmentera (dépassement du quota quotidien) ou pour lancer des campagnes marketing de masse.

## 10. Roadmap (Prochaines Étapes)

Afin d'assurer le lancement et l'évolution de la Marketplace, voici notre feuille de route pour les prochaines étapes :

### Court Terme (Finalisation Technique)
- **Visibilité (SEO & GEO) :** Optimisation du référencement naturel (SEO) et du référencement génératif par IA (GEO) pour garantir une bonne visibilité de la plateforme.
- **Authentification Mobile & Sociale :** Intégration et test de l'authentification par numéro de téléphone (OTP par SMS) ainsi que la connexion via Facebook (cette dernière nécessitera également la soumission des documents de l'entreprise).
- **Intégration FlexPaie :** Soumission des documents administratifs, paiement des frais d'activation et intégration des clés API pour les paiements réels.

### Moyen Terme (Lancement et Acquisition)
- **Mise en Production :** Achat du nom de domaine officiel (`newket.market`) et passage au plan d'hébergement Vercel Pro.
- **Onboarding Vendeurs Bêta :** Lancement de la phase d'acquisition et certification des premiers marchands pour alimenter le catalogue.
- **Lancement Public :** Ouverture officielle de la plateforme aux acheteurs avec mise en avant du système de parrainage et codes promo.

### Long Terme (Croissance)
- **Applications Mobiles :** Développement et déploiement d'une application dédiée (iOS et Android) pour fluidifier l'expérience mobile (pas avant d'atteindre 1 000 utilisateurs actifs).
- **Messagerie Interne (Chat) :** Intégration d'un chat acheteur-vendeur juste après avoir atteint le cap des 1 000 utilisateurs actifs (pour éviter que les transactions ne se finalisent en dehors de la plateforme via des échanges de numéros WhatsApp à ce stade précoce).
- **Évolution Logistique :** Ajout de nouvelles options de livraison et d'un suivi potentiellement plus avancé.
- **Abonnements Vendeurs :** Mise en place d'un modèle d'abonnement dès que la plateforme atteindra 1000 vendeurs et un minimum de 500 utilisateurs globaux actifs par mois. Trois offres seront proposées (fonctionnalités et avantages à définir avec l'équipe) :
  - *Plan Gratuit (Free)* : Fonctionnalités basiques (publication et transactions normales).
  - *Plan Pro (1,99$/mois)* : Fonctionnalités du plan gratuit + certains avantages spécifiques.
  - *Plan Avancé (3,99$/mois)* : Fonctionnalités des plans précédents + d'autres avantages supplémentaires exclusifs.

---

*Note : L'infrastructure technique est stable (organisation en "monorepo" – c'est-à-dire que tous les codes du projet : site, application et backend sont centralisés au même endroit pour une meilleure gestion), ce qui nous permet maintenant d'itérer et d'ajouter de nouvelles fonctionnalités plus rapidement.*
