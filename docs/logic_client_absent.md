# Architecture : Signalement "Client Absent" (No-Show)

## Le Problème à Résoudre
Dans une marketplace avec paiement séquestré (Escrow), la livraison physique "en main propre" crée un point de faille : **si l'acheteur ne se présente pas au rendez-vous**, le vendeur perd du temps et le produit est immobilisé. Cependant, donner au vendeur le droit d'annuler instantanément en déclarant "le client est absent" ouvrirait la porte aux vendeurs malhonnêtes qui pourraient empocher l'argent sans jamais se déplacer.

## La Logique 100% Sécurisée implémentée dans NewKet

Pour protéger à la fois l'acheteur et le vendeur, la fonctionnalité "Signaler client absent" est régie par les règles suivantes :

### 1. Le Délai de Carence (48 heures minimum)
Le bouton "Signaler client absent" est affiché au vendeur dès que la commande passe en livraison (`IN_DELIVERY`). Cependant, **le vendeur ne peut l'utiliser qu'après un délai strict de 48 heures** suivant le début de la livraison.
- **Pourquoi ?** Cela garantit que l'acheteur a eu le temps de se manifester ou d'ouvrir un litige ("Signaler un problème") s'il estime que le vendeur ne s'est pas présenté.

### 2. Le Blocage Mutuel (Stand-off)
Durant ces 48 heures :
- L'argent est bloqué par NewKet (statut `HELD`).
- Si le vendeur essaie de cliquer sur le bouton avant les 48h, le backend rejette l'action avec une erreur 400.
- L'acheteur, s'il a reçu le produit, est censé transmettre le code OTP pour valider.
- L'acheteur a aussi le bouton "Signaler un problème" en cas de litige.

### 3. La Résolution par "No-Show"
Si les 48 heures s'écoulent sans que l'acheteur n'ait ni fourni l'OTP, ni ouvert de litige :
- Le backend considère que le silence de l'acheteur est une acceptation tacite ou un abandon (No-show effectif).
- Le vendeur peut alors cliquer avec succès sur "Signaler client absent".
- **Résultat automatique :** Le backend annule la commande, **pénalise l'acheteur**, et autorise la libération d'un dédommagement ou la totalité des fonds au vendeur.

### 4. Code Backend (Preuve)
Voici la logique exacte extraite du contrôleur de commandes (`backend/src/controllers/order.controller.js`, ligne 849) :

```javascript
// Vérifier si 48h se sont écoulées depuis le début de la livraison
const inDeliveryAt = order.in_delivery_at ? new Date(order.in_delivery_at) : new Date(order.updated_at);
const now = new Date();
const diffHours = (now - inDeliveryAt) / (1000 * 60 * 60);

if (diffHours < 48) {
    return res.status(400).json({ 
        error: `Vous devez attendre 48h après le début de la livraison pour signaler une absence. (Écoulé: ${Math.floor(diffHours)}h)` 
    });
}
```

## Évolutions possibles (Optionnelles)
Si vous voulez rendre cette preuve d'absence encore plus blindée dans le futur :
- Demander au vendeur de partager sa géolocalisation GPS au moment de cliquer sur "Client absent" (pour prouver qu'il était bien sur le lieu de livraison).
- Demander une preuve photographique (ex: le colis devant la porte de l'adresse de livraison).
