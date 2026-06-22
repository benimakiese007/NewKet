import Foundation

/// Modèle représentant la table `products` de votre base de données Supabase.
/// Ce modèle est conforme à Codable pour parser automatiquement le JSON reçu.
struct SupabaseProduct: Codable, Identifiable {
    let id: UUID
    let name: String
    let price: Double
    let image: String? // URL de l'image (peut être une liste séparée par des virgules comme vu sur le web)
    let category: String?
    let pinned: Bool?
    let isNew: Bool?
    let isPromo: Bool?
    let oldPrice: Double?
    
    // Pour joindre le nom du vendeur ou de la marque (facultatif si non joint dans la requête)
    // var users: SupplierInfo?
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case price
        case image
        case category
        case pinned
        case isNew = "is_new"
        case isPromo = "is_promo"
        case oldPrice = "old_price"
    }
    
    // Helper pour extraire la première image si c'est une liste séparée par des virgules
    var firstImageURL: URL? {
        guard let imageStr = image else { return nil }
        let urls = imageStr.components(separatedBy: ",")
        guard let first = urls.first?.trimmingCharacters(in: .whitespacesAndNewlines), !first.isEmpty else {
            return nil
        }
        return URL(string: first)
    }
    
    var formattedPrice: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD" // Ou EUR, selon votre boutique
        return formatter.string(from: NSNumber(value: price)) ?? "\(price) $"
    }
}
