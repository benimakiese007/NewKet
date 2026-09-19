# 💼 Idées — Comptabilité & Juridique NewKet

> Document de réflexion interne — Rédigé le 19 septembre 2026
> À compléter et valider avec un expert-comptable et juriste à Kinshasa.

---

## 🏢 Structure Juridique

### Forme choisie : SARL
- **8 associés fondateurs** (tous dans le capital)
- 1 CEO (Gérant)
- 3 Développeurs (dont 1 membre du conseil d'administration)
- 3 Marketeurs
- 1 Conseillère Stratégique
- **Conseil d'administration interne : 3 membres**

### ⚠️ Points à trancher avant l'immatriculation
- Répartition des parts sociales entre les 8 associés (égalitaire ou pondérée selon le rôle/apport ?)
- Statut exact du CEO : gérant majoritaire ou minoritaire ? (Impact direct sur la protection sociale)
- Qui est dans le conseil d'admin et avec quels pouvoirs ?

---

## 🌍 Contexte Fiscal — RDC (Kinshasa)

### TVA
| Seuil de CA annuel | Obligation TVA |
|-------------------|----------------|
| < 80 millions CDF | ❌ Pas de TVA à collecter |
| ≥ 80 millions CDF | ✅ TVA à 16% obligatoire — enregistrement à la DGI requis |

> ⚠️ Ce seuil est à confirmer avec la DGI ou un comptable local car il peut évoluer.

**Décision NewKet :** Pas de TVA appliquée sur les transactions entre vendeurs et acheteurs. NewKet est un simple intermédiaire. La TVA sur la commission NewKet s'appliquera uniquement si le seuil est dépassé.

---

### IBP — Impôt sur les Bénéfices et Profits
- **Taux : 35%** sur les bénéfices nets de l'entreprise
- **Cotisation Minimale (CM) : 1% du CA**, due même si le bénéfice est nul ou négatif
  - Exemple : CA de 10M CDF → 100 000 CDF à payer à l'État minimum

**Flux fiscal réel :**
```
Revenus (commissions plateforme)
   ↓  - Charges déductibles (salaires, serveurs, marketing, frais…)
= Bénéfice imposable
   ↓  - IBP 35%
= Bénéfice net après impôt
   ↓  50% → Réserve de croissance (en caisse)
   ↓  50% → Distribution aux associés selon parts sociales
```

---

## 💰 Stratégie de Distribution Décidée en Réunion

- **50%** du bénéfice net reste sur le compte entreprise (réserve de croissance)
- **50%** est distribué entre les 8 associés **proportionnellement à leurs parts sociales**
- Pas de salariés externes pour le moment — les associés actifs seront les seuls bénéficiaires

---

## ⚖️ Double Taxation — Le Piège à Éviter

Le problème de la SARL classique :
1. L'entreprise paie **IBP (35%)** sur ses bénéfices
2. Les associés paient une **retenue à la source sur dividendes** (10–20% en RDC) sur les sommes reçues

→ Le même argent est taxé **deux fois**.

---

## 🛡️ Stratégies Légales d'Optimisation

### ✅ Option 1 — Salaires / Rémunération de Gérance
Les associés actifs se versent un salaire ou une rémunération de gérance **avant** le calcul du bénéfice :
- Salaires = charges déductibles → réduit le bénéfice imposable → réduit l'IBP
- Le CEO (gérant) touche une **rémunération de gérance** (déductible)
- Les autres associés actifs peuvent avoir des contrats de travail (salaires déductibles)

> ⚠️ Les salaires sont soumis à l'**IPR (Impôt Professionnel sur les Rémunérations)** — taux progressif :
> - Bas salaires → ~3% à 15%
> - Salaires moyens → ~20% à 30%
> - Hauts salaires → 40%+
> + cotisations **INSS** (sécurité sociale)

### ✅ Option 2 — Maximiser les Charges Déductibles
Passer un maximum de dépenses réelles par la boîte **avant** l'IBP :

| Dépense | Déductible |
|---------|-----------|
| Serveurs / Hébergement | ✅ |
| Ordinateurs / Téléphones | ✅ |
| Publicité / Ads | ✅ |
| Déplacements | ✅ |
| Loyer bureau | ✅ |
| Formations | ✅ |

### ✅ Option 3 — Réinvestissement Total (Phase de lancement)
Ne pas distribuer de bénéfices les premières années.
Réinvestir tout le cash dans la croissance → bénéfice comptable ≈ 0 → IBP ≈ 0.

### ⚠️ Option "Tout en Salaires" — Attention
- IBP = 0 si tout part en salaires ✅
- Mais IPR progressif peut coûter **plus que 35%** sur de gros montants ❌
- La DGI peut **requalifier** des salaires excessifs en dividendes ❌
- La Cotisation Minimale (1% CA) reste due **dans tous les cas** ❌

### 🎯 Conclusion : Le Mix Optimal
Il n'y a pas de solution universelle. Le bon équilibre **salaire + dividendes** dépend du montant de revenus dégagés. À faire calculer par un comptable fiscal à Kinshasa.

---

## 📋 Marketplace & Fiscalité des Transactions

### Modèle de revenus : Commission sur chaque transaction
- B2B, B2C et C2C (mix)
- Commission prélevée sur chaque transaction aboutie
- **Pas d'abonnement** pour la V1

### Système de paiement : Séquestre (Escrow)
- Les fonds de l'acheteur sont bloqués sur le compte marchand NewKet
- Libérés au vendeur après confirmation de réception ou à l'issue d'un délai défini
- **Statut juridique critique :** NewKet agit en tant qu'**agent** et non en tant que **principal** (sinon la TVA s'applique sur le montant total, pas juste la commission)
- Cette distinction est inscrite dans les CGV ✅

### TVA sur les transactions
- Décision : **pas de TVA appliquée** sur les transactions entre utilisateurs
- Seule la commission NewKet sera soumise à TVA si le seuil de 80M CDF est atteint

---

## 📜 CGV — Clauses Clés Intégrées (terms.html)

| Clause | Statut |
|--------|--------|
| Rôle d'intermédiaire (agent vs principal) | ✅ Intégrée |
| Paiement sous séquestre | ✅ Intégrée |
| Commission et frais | ✅ Intégrée |
| Prix libres définis par les vendeurs | ✅ Intégrée |
| Taux de change libre par vendeur | ✅ Intégrée |
| Droit applicable : RDC | ✅ Intégrée |
| Juridiction compétente : Kinshasa | ✅ Intégrée |
| Responsabilité limitée (hébergeur/intermédiaire) | ✅ Intégrée |

---

## 🔴 Actions Prioritaires Avant Lancement

- [ ] **Engager un expert-comptable à Kinshasa** pour structurer la fiscalité dès le départ
- [ ] **Engager un juriste RDC** pour valider les CGV, les statuts SARL et les pactes d'associés
- [ ] **Décider la répartition des parts** entre les 8 associés (avant immatriculation)
- [ ] **Rédiger un Pacte d'Associés** (qui part = que se passe-t-il avec ses parts ?)
- [ ] **Ouvrir un compte bancaire entreprise** dédié au séquestre
- [ ] **Immatriculer la SARL** au Registre du Commerce de Kinshasa (RCCM)
- [ ] **S'enregistrer à la DGI** pour obtenir le NIF (Numéro d'Identification Fiscale)
