import Foundation
import SwiftUI

/// Vue-modèle pour la page d'accueil.
/// Gère le téléchargement des données depuis Supabase.
@MainActor
class HomeViewModel: ObservableObject {
    @Published var pinnedProducts: [SupabaseProduct] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil
    
    func fetchPinnedProducts() async {
        self.isLoading = true
        self.errorMessage = nil
        
        do {
            // CODE REEL SUPABASE (A décommenter une fois le SDK installé dans Xcode) :
            /*
            let products: [SupabaseProduct] = try await SupabaseService.shared.client
                .from("products")
                .select()
                .eq("pinned", value: true)
                .order("created_at", ascending: false)
                .execute()
                .value
            
            self.pinnedProducts = products
            */
            
            // --- SIMULATION POUR LE PROTOTYPE SANS XCODE ---
            // Le temps de la compilation, on simule un appel réseau de 1.5 secondes
            // puis on injecte des données qui ont la structure Supabase.
            try await Task.sleep(nanoseconds: 1_500_000_000)
            
            self.pinnedProducts = [
                SupabaseProduct(id: UUID(), name: "Montre de luxe Vrai Produit", price: 2500.0, image: "https://newket.vercel.app/Images/marketplace-hero.jpg", category: "Montres", pinned: true, isNew: true, isPromo: false, oldPrice: nil),
                SupabaseProduct(id: UUID(), name: "Sac en cuir (Depuis DB)", price: 850.0, image: "https://newket.vercel.app/Images/marketplace-hero.jpg", category: "Sacs", pinned: true, isNew: false, isPromo: false, oldPrice: nil)
            ]
            
        } catch {
            self.errorMessage = "Erreur lors du chargement des produits."
            print("Erreur Supabase: \(error)")
        }
        
        self.isLoading = false
    }
}
