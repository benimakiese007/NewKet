import Foundation
import ActivityKit

// MARK: - NewKet Order Tracking Attributes for ActivityKit (iOS 16.1+)

@available(iOS 16.1, *)
public struct OrderTrackingAttributes: ActivityAttributes {

    // Dynamic state that updates as the order progresses
    public struct ContentState: Codable, Hashable {
        public var status: String              // e.g. "PROCESSING", "IN_DELIVERY", "DELIVERED", "CANCELLED"
        public var statusTitle: String         // e.g. "En cours de livraison"
        public var statusDescription: String   // e.g. "Le livreur est en route vers votre adresse"
        public var progress: Double            // 0.0 to 1.0
        public var currentStep: Int            // 1: Confirmé, 2: Préparation, 3: En route, 4: Livré
        public var totalSteps: Int             // 4
        public var etaText: String?            // e.g. "~15 min", "14:30"
        public var isCancelled: Bool           // Flag for cancellation/dispute

        public init(
            status: String,
            statusTitle: String,
            statusDescription: String,
            progress: Double,
            currentStep: Int = 1,
            totalSteps: Int = 4,
            etaText: String? = nil,
            isCancelled: Bool = false
        ) {
            self.status = status
            self.statusTitle = statusTitle
            self.statusDescription = statusDescription
            self.progress = progress
            self.currentStep = currentStep
            self.totalSteps = totalSteps
            self.etaText = etaText
            self.isCancelled = isCancelled
        }
    }

    // Static attributes fixed for the lifetime of this specific order activity
    public var orderId: String       // e.g. "NK-84291"
    public var orderNumber: String   // e.g. "Commande #84291"
    public var shopName: String      // e.g. "Maison Zara Kinshasa"
    public var itemCount: Int        // e.g. 2 articles

    public init(orderId: String, orderNumber: String, shopName: String = "NewKet", itemCount: Int = 1) {
        self.orderId = orderId
        self.orderNumber = orderNumber
        self.shopName = shopName
        self.itemCount = itemCount
    }
}
