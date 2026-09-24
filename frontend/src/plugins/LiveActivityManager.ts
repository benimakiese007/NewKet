import { LiveActivityPlugin } from './LiveActivityPlugin';

/**
 * Helper centralisé pour gérer les Live Activities de l'application NewKet.
 * Simplifie l'appel au plugin avec des modèles prédéfinis pour les Acheteurs et Vendeurs.
 */

// ---------------------------------------------------------------------------
// 🛍️ ACHETEUR (Buyer)
// ---------------------------------------------------------------------------
export const BuyerActivities = {
  /** Le client vient de valider son panier et lance le paiement */
  startPayment: async (orderId: string) => {
    return LiveActivityPlugin.startActivity({
      title: "Achat NewKet",
      entityId: `Commande N°${orderId}`,
      icon: "🛒",
      statusTitle: "Paiement en cours",
      statusDescription: "Vérification de votre transaction...",
      progress: 0.1
    });
  },
  /** Le paiement est validé par la banque/le système */
  paymentConfirmed: async () => {
    return LiveActivityPlugin.updateActivity({
      statusTitle: "Paiement confirmé",
      statusDescription: "Votre commande est validée et payée",
      progress: 0.3
    });
  },
  /** Le paiement a échoué (fonds insuffisants, erreur réseau) */
  paymentFailed: async () => {
    await LiveActivityPlugin.updateActivity({
      statusTitle: "Paiement refusé",
      statusDescription: "Échec de la transaction, veuillez réessayer",
      progress: 0.0
    });
    // On termine l'activité au bout de quelques secondes car c'est un échec
    setTimeout(() => LiveActivityPlugin.endActivity(), 10000);
  },
  /** Le vendeur a accepté et prépare la commande */
  orderPreparing: async () => {
    return LiveActivityPlugin.updateActivity({
      statusTitle: "En préparation",
      statusDescription: "Le vendeur prépare votre colis",
      progress: 0.6
    });
  },
  /** La commande est en route */
  orderShipped: async (deliveryTime: string = "") => {
    return LiveActivityPlugin.updateActivity({
      statusTitle: "Livraison en cours",
      statusDescription: deliveryTime ? `Livraison estimée : ${deliveryTime}` : "Votre colis est en route",
      progress: 0.9
    });
  },
  /** La commande est livrée au client */
  orderDelivered: async () => {
    await LiveActivityPlugin.updateActivity({
      statusTitle: "Livraison terminée",
      statusDescription: "Bonne réception !",
      progress: 1.0
    });
    setTimeout(() => LiveActivityPlugin.endActivity(), 10000);
  },
  /** Remboursement effectué */
  refundIssued: async () => {
    await LiveActivityPlugin.updateActivity({
      statusTitle: "Remboursement émis",
      statusDescription: "Les fonds ont été renvoyés sur votre compte",
      progress: 1.0
    });
    setTimeout(() => LiveActivityPlugin.endActivity(), 10000);
  }
};

// ---------------------------------------------------------------------------
// 🏪 VENDEUR (Seller)
// ---------------------------------------------------------------------------
export const SellerActivities = {
  /** L'acheteur a payé, le vendeur doit préparer la commande */
  paymentReceived: async (orderId: string) => {
    return LiveActivityPlugin.startActivity({
      title: "Espace Vendeur",
      entityId: `Commande N°${orderId}`,
      icon: "💰",
      statusTitle: "Paiement acheteur reçu",
      statusDescription: "Fonds sécurisés. Préparez la commande !",
      progress: 0.3
    });
  },
  /** Le vendeur prépare la commande */
  orderPreparing: async () => {
    return LiveActivityPlugin.updateActivity({
      statusTitle: "En préparation",
      statusDescription: "En attente d'expédition",
      progress: 0.6
    });
  },
  /** Le vendeur a expédié la commande */
  orderShipped: async () => {
    return LiveActivityPlugin.updateActivity({
      statusTitle: "Commande expédiée",
      statusDescription: "En cours d'acheminement vers le client",
      progress: 0.9
    });
  },
  /** La transaction est totalement terminée, le vendeur reçoit son argent */
  fundsUnlocked: async () => {
    await LiveActivityPlugin.updateActivity({
      statusTitle: "Paiement débloqué",
      statusDescription: "Fonds transférés sur votre solde vendeur",
      progress: 1.0
    });
    setTimeout(() => LiveActivityPlugin.endActivity(), 10000);
  }
};

// ---------------------------------------------------------------------------
// ❌ FONCTION COMMUNE (Fin / Annulation)
// ---------------------------------------------------------------------------
export const clearLiveActivity = async () => {
  return LiveActivityPlugin.endActivity();
};
