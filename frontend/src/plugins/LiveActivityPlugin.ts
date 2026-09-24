import { registerPlugin } from '@capacitor/core';

export interface LiveActivityPluginPlugin {
  startActivity(options: { 
    title: string;          // ex: "Achat NewKet", "Espace Vendeur", "Admin NewKet"
    entityId: string;       // ex: "Commande N°123", "Devis N°45"
    icon: string;           // ex: "📦", "📄", "🛠️"
    statusTitle: string;    // ex: "Commande envoyée", "Devis reçu"
    statusDescription: string; // ex: "En attente de validation", "Livraison estimée 14h"
    progress: number;       // 0.0 to 1.0
  }): Promise<{ success: boolean }>;
  
  updateActivity(options: { 
    statusTitle: string; 
    statusDescription: string;
    progress: number; 
  }): Promise<{ success: boolean }>;
  
  endActivity(): Promise<{ success: boolean }>;
}

export const LiveActivityPlugin = registerPlugin<LiveActivityPluginPlugin>('LiveActivityPlugin');
