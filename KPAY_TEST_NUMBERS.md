# Documentation des Numéros de Test K-PAY (RD Congo)

Cette documentation regroupe tous les numéros de test officiels pour simuler des paiements et des retraits avec K-PAY en environnement de test (Sandbox) pour la République Démocratique du Congo (RDC).

**Pays :** RD Congo
**Fournisseurs supportés (Providers) :** `VODACOM_MPESA_COD`, `AIRTEL_COD`, `ORANGE_COD`

---

## 1. Paiements (Deposits)
Ces numéros servent à tester le flux de paiement (lorsqu'un client paie sur votre site).
*Note : Sur la page de paiement K-PAY qui pré-remplit l'indicatif (+243), il suffit de taper les chiffres qui suivent le "243" (ex: 813456789).*

| Numéro (MSISDN) | Résultat (RESULT) | Code d'erreur (FAILURECODE) | Description |
| :--- | :--- | :--- | :--- |
| **243813456789** | **COMPLETED** | - | **Paiement réussi avec succès** |
| 243813456129 | SUBMITTED | - | En attente / Soumis |
| 243813456019 | FAILED | PAYER_LIMIT_REACHED | Échec : Limite du payeur atteinte |
| 243813456029 | FAILED | PAYER_NOT_FOUND | Échec : Compte payeur introuvable |
| 243813456039 | FAILED | PAYMENT_NOT_APPROVED | Échec : Paiement non approuvé |
| 243813456049 | FAILED | INSUFFICIENT_BALANCE | Échec : Solde insuffisant |
| 243813456069 | FAILED | UNSPECIFIED_FAILURE | Échec : Raison non spécifiée |

---

## 2. Retraits (Withdrawals / Payouts)
Ces numéros servent à tester le flux de retrait (lorsque vous envoyez de l'argent vers le portefeuille Mobile Money d'un utilisateur).

| Numéro (MSISDN) | Résultat (RESULT) | Code d'erreur (FAILURECODE) | Description |
| :--- | :--- | :--- | :--- |
| **243813456789** | **COMPLETED** | - | **Retrait réussi avec succès** |
| 243813456129 | SUBMITTED | - | En attente / Soumis |
| 243813456089 | FAILED | RECIPIENT_NOT_FOUND | Échec : Destinataire introuvable |
| 243813456119 | FAILED | UNSPECIFIED_FAILURE | Échec : Raison non spécifiée |

---

## 3. Passage en Production (Going to production)
Une fois que votre intégration est testée avec succès dans l'environnement Sandbox (mode test), voici les étapes pour passer en réel :

1. Allez sur votre tableau de bord K-PAY.
2. Complétez la **vérification d'identité (KYC)** depuis le menu "Verification".
3. Une fois validé, cela débloquera vos clés de production (`kpay_live_...`).
4. Remplacez les clés test par les clés de production dans le fichier `.env` de votre backend.

⚠️ *Tant que le processus KYC n'est pas validé, la génération des clés de production est refusée par K-PAY.*
