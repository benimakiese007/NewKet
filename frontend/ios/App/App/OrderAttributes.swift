import Foundation
import ActivityKit

@available(iOS 16.1, *)
public struct TrackingAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var statusTitle: String
        public var statusDescription: String
        public var progress: Double
    }

    public var title: String      // ex: "Achat NewKet", "Vente NewKet", "Admin"
    public var entityId: String   // ex: "Commande N°123", "Devis N°45"
    public var icon: String       // ex: "📦", "📄", "🛠️"
    
    public init(title: String, entityId: String, icon: String) {
        self.title = title
        self.entityId = entityId
        self.icon = icon
    }
}
