import Foundation
import Capacitor
import ActivityKit

// MARK: - LiveActivityPlugin (Capacitor iOS Plugin)

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin {

    // Store active activities mapped by orderId
    @available(iOS 16.1, *)
    private static var activeActivities: [String: Activity<OrderTrackingAttributes>] = [:]

    // MARK: - isAvailable
    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 16.1, *) {
            let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
            call.resolve([
                "available": true,
                "enabled": enabled
            ])
        } else {
            call.resolve([
                "available": false,
                "enabled": false
            ])
        }
    }

    // MARK: - startActivity
    @objc func startActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities require iOS 16.1 or newer.")
            return
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities are disabled by the user in Settings.")
            return
        }

        let orderId           = call.getString("orderId") ?? UUID().uuidString
        let orderNumber       = call.getString("orderNumber") ?? "#NK-\(orderId.prefix(6))"
        let shopName          = call.getString("shopName") ?? "NewKet"
        let itemCount         = call.getInt("itemCount") ?? 1

        let status            = call.getString("status") ?? "PROCESSING"
        let statusTitle       = call.getString("statusTitle") ?? "Commande en cours"
        let statusDescription = call.getString("statusDescription") ?? "Votre commande est en cours de traitement."
        let progress          = call.getDouble("progress") ?? 0.25
        let currentStep       = call.getInt("currentStep") ?? 1
        let totalSteps        = call.getInt("totalSteps") ?? 4
        let etaText           = call.getString("etaText")
        let isCancelled       = call.getBool("isCancelled") ?? false

        // Idempotency: if an activity for this orderId already exists, update it instead of creating duplicate
        if let existing = Self.activeActivities[orderId] {
            let contentState = OrderTrackingAttributes.ContentState(
                status: status,
                statusTitle: statusTitle,
                statusDescription: statusDescription,
                progress: progress,
                currentStep: currentStep,
                totalSteps: totalSteps,
                etaText: etaText,
                isCancelled: isCancelled
            )
            Task {
                if #available(iOS 16.2, *) {
                    await existing.update(ActivityContent(state: contentState, staleDate: nil))
                } else {
                    await existing.update(using: contentState)
                }
            }
            call.resolve(["success": true, "orderId": orderId, "updated": true])
            return
        }

        let attributes = OrderTrackingAttributes(
            orderId: orderId,
            orderNumber: orderNumber,
            shopName: shopName,
            itemCount: itemCount
        )

        let contentState = OrderTrackingAttributes.ContentState(
            status: status,
            statusTitle: statusTitle,
            statusDescription: statusDescription,
            progress: progress,
            currentStep: currentStep,
            totalSteps: totalSteps,
            etaText: etaText,
            isCancelled: isCancelled
        )

        do {
            let activity: Activity<OrderTrackingAttributes>
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: contentState, staleDate: nil)
                activity = try Activity.request(
                    attributes: attributes,
                    content: content,
                    pushType: .token
                )
            } else {
                activity = try Activity.request(
                    attributes: attributes,
                    contentState: contentState,
                    pushType: .token
                )
            }

            Self.activeActivities[orderId] = activity

            // Listen for push token updates so backend can update remotely via APNs
            Task {
                for await pushToken in activity.pushTokenUpdates {
                    let tokenString = pushToken.map { String(format: "%02x", $0) }.joined()
                    self.notifyListeners("activityPushToken", data: [
                        "orderId": orderId,
                        "token": tokenString
                    ])
                }
            }

            call.resolve(["success": true, "orderId": orderId])
        } catch {
            call.reject("Failed to request Live Activity: \(error.localizedDescription)")
        }
    }

    // MARK: - updateActivity
    @objc func updateActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Not supported on this iOS version.")
            return
        }

        guard let orderId = call.getString("orderId") else {
            call.reject("Missing 'orderId' parameter.")
            return
        }

        guard let activity = Self.activeActivities[orderId] else {
            // If not found in memory, try searching all active activities
            if let matched = Activity<OrderTrackingAttributes>.activities.first(where: { $0.attributes.orderId == orderId }) {
                Self.activeActivities[orderId] = matched
            } else {
                call.reject("No active Live Activity found for order \(orderId)")
                return
            }
            return
        }

        let status            = call.getString("status") ?? "PROCESSING"
        let statusTitle       = call.getString("statusTitle") ?? "Mise à jour"
        let statusDescription = call.getString("statusDescription") ?? ""
        let progress          = call.getDouble("progress") ?? 0.5
        let currentStep       = call.getInt("currentStep") ?? 2
        let totalSteps        = call.getInt("totalSteps") ?? 4
        let etaText           = call.getString("etaText")
        let isCancelled       = call.getBool("isCancelled") ?? false

        let contentState = OrderTrackingAttributes.ContentState(
            status: status,
            statusTitle: statusTitle,
            statusDescription: statusDescription,
            progress: progress,
            currentStep: currentStep,
            totalSteps: totalSteps,
            etaText: etaText,
            isCancelled: isCancelled
        )

        Task {
            if #available(iOS 16.2, *) {
                await activity.update(ActivityContent(state: contentState, staleDate: nil))
            } else {
                await activity.update(using: contentState)
            }
            call.resolve(["success": true, "orderId": orderId])
        }
    }

    // MARK: - endActivity
    @objc func endActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve(["success": true])
            return
        }

        let orderId = call.getString("orderId")

        Task {
            if let orderId = orderId, let activity = Self.activeActivities[orderId] {
                if #available(iOS 16.2, *) {
                    await activity.end(nil, dismissalPolicy: .after(.now + 15)) // Keep 15s so user sees completion
                } else {
                    await activity.end(using: nil, dismissalPolicy: .immediate)
                }
                Self.activeActivities.removeValue(forKey: orderId)
            } else {
                // End all if orderId omitted
                for (_, activity) in Self.activeActivities {
                    if #available(iOS 16.2, *) {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    } else {
                        await activity.end(using: nil, dismissalPolicy: .immediate)
                    }
                }
                Self.activeActivities.removeAll()
            }
            call.resolve(["success": true])
        }
    }
}
