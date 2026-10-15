import Foundation
import UIKit
import Capacitor
import ActivityKit

// MARK: - LiveActivityPlugin (Capacitor iOS Plugin)

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivityPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDiagnostics", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "triggerHaptic", returnType: CAPPluginReturnPromise)
    ]

    // Store active activities mapped by orderId
    @available(iOS 16.1, *)
    private static var activeActivities: [String: Activity<OrderTrackingAttributes>] = [:]

    // In-memory diagnostic ring buffer (last 50 events)
    private static var diagnosticLogs: [[String: Any]] = []
    private static let logLock = NSLock()

    private static func logEvent(tag: String, message: String, error: String? = nil, details: [String: Any]? = nil) {
        logLock.lock()
        defer { logLock.unlock() }
        let formatter = ISO8601DateFormatter()
        var entry: [String: Any] = [
            "time": formatter.string(from: Date()),
            "tag": tag,
            "message": message
        ]
        if let err = error {
            entry["error"] = err
        }
        if let det = details {
            entry["details"] = det
        }
        diagnosticLogs.append(entry)
        if diagnosticLogs.count > 50 {
            diagnosticLogs.removeFirst()
        }
        #if DEBUG
        print("[NewKet-LiveActivity][\(tag)] \(message)\(error != nil ? " | Error: " + error! : "")")
        #endif
    }

    // MARK: - isAvailable
    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 16.1, *) {
            let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
            var frequentPushes = false
            if #available(iOS 16.2, *) {
                frequentPushes = ActivityAuthorizationInfo().frequentPushesEnabled
            }
            Self.logEvent(tag: "CHECK", message: "isAvailable queried", details: [
                "available": true,
                "enabled": enabled,
                "frequentPushes": frequentPushes
            ])
            call.resolve([
                "available": true,
                "enabled": enabled,
                "frequentPushesEnabled": frequentPushes,
                "iosVersion": UIDevice.current.systemVersion
            ])
        } else {
            Self.logEvent(tag: "CHECK", message: "ActivityKit not supported on iOS < 16.1", error: "OS_UNSUPPORTED")
            call.resolve([
                "available": false,
                "enabled": false,
                "frequentPushesEnabled": false,
                "iosVersion": UIDevice.current.systemVersion
            ])
        }
    }

    // MARK: - startActivity
    @objc func startActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            let err = "Live Activities require iOS 16.1 or newer. Current: \(UIDevice.current.systemVersion)"
            Self.logEvent(tag: "START", message: "Failed - OS too old", error: err)
            call.reject(err)
            return
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            let err = "Live Activities are disabled in iOS Settings for NewKet."
            Self.logEvent(tag: "START", message: "Failed - Disabled in iOS Settings", error: err)
            call.reject(err)
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

        Self.logEvent(tag: "START", message: "Requesting Live Activity for \(orderNumber) (\(status))")

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
            Self.logEvent(tag: "START", message: "Activity already existed -> updated", details: [
                "orderId": orderId,
                "activityId": existing.id
            ])
            call.resolve([
                "success": true,
                "orderId": orderId,
                "activityId": existing.id,
                "updated": true
            ])
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
                // First try with pushType: nil for robust local delivery (free developer / sideload accounts)
                do {
                    activity = try Activity.request(
                        attributes: attributes,
                        content: content,
                        pushType: nil
                    )
                } catch {
                    Self.logEvent(tag: "START", message: "pushType nil failed, trying token", error: error.localizedDescription)
                    activity = try Activity.request(
                        attributes: attributes,
                        content: content,
                        pushType: .token
                    )
                }
            } else {
                do {
                    activity = try Activity.request(
                        attributes: attributes,
                        contentState: contentState,
                        pushType: nil
                    )
                } catch {
                    Self.logEvent(tag: "START", message: "pushType nil failed (iOS 16.1), trying token", error: error.localizedDescription)
                    activity = try Activity.request(
                        attributes: attributes,
                        contentState: contentState,
                        pushType: .token
                    )
                }
            }

            Self.activeActivities[orderId] = activity

            Self.logEvent(tag: "START", message: "Activity successfully created", details: [
                "orderId": orderId,
                "activityId": activity.id,
                "status": status
            ])

            // Listen for push token updates so backend can update remotely via APNs (if available)
            Task {
                for await pushToken in activity.pushTokenUpdates {
                    let tokenString = pushToken.map { String(format: "%02x", $0) }.joined()
                    Self.logEvent(tag: "PUSH_TOKEN", message: "Token received for \(orderId)")
                    self.notifyListeners("activityPushToken", data: [
                        "orderId": orderId,
                        "token": tokenString
                    ])
                }
            }

            call.resolve([
                "success": true,
                "orderId": orderId,
                "activityId": activity.id
            ])
        } catch {
            let errorMsg = "Failed to request Live Activity: \(error.localizedDescription)"
            Self.logEvent(tag: "START", message: "Exception during Activity.request", error: errorMsg)
            call.reject(errorMsg)
        }
    }

    // MARK: - updateActivity
    @objc func updateActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            let err = "Not supported on this iOS version."
            Self.logEvent(tag: "UPDATE", message: "Failed - OS too old", error: err)
            call.reject(err)
            return
        }

        guard let orderId = call.getString("orderId") else {
            let err = "Missing 'orderId' parameter."
            Self.logEvent(tag: "UPDATE", message: "Validation error", error: err)
            call.reject(err)
            return
        }

        let targetActivity: Activity<OrderTrackingAttributes>
        if let existing = Self.activeActivities[orderId] {
            targetActivity = existing
        } else if let matched = Activity<OrderTrackingAttributes>.activities.first(where: { $0.attributes.orderId == orderId }) {
            Self.activeActivities[orderId] = matched
            targetActivity = matched
        } else {
            let err = "No active Live Activity found for order \(orderId). Active count: \(Activity<OrderTrackingAttributes>.activities.count)"
            Self.logEvent(tag: "UPDATE", message: "Activity not found", error: err)
            call.reject(err)
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
                await targetActivity.update(ActivityContent(state: contentState, staleDate: nil))
            } else {
                await targetActivity.update(using: contentState)
            }
            Self.logEvent(tag: "UPDATE", message: "Activity updated for \(orderId)", details: [
                "orderId": orderId,
                "activityId": targetActivity.id,
                "status": status,
                "progress": progress
            ])
            call.resolve([
                "success": true,
                "orderId": orderId,
                "activityId": targetActivity.id
            ])
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
                Self.logEvent(tag: "END", message: "Ended activity for \(orderId)", details: ["activityId": activity.id])
            } else {
                // End all if orderId omitted
                for (oid, activity) in Self.activeActivities {
                    if #available(iOS 16.2, *) {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    } else {
                        await activity.end(using: nil, dismissalPolicy: .immediate)
                    }
                    Self.logEvent(tag: "END", message: "Ended activity for \(oid)", details: ["activityId": activity.id])
                }
                Self.activeActivities.removeAll()
            }
            call.resolve(["success": true])
        }
    }

    // MARK: - getDiagnostics
    @objc func getDiagnostics(_ call: CAPPluginCall) {
        var diag: [String: Any] = [:]
        diag["iosVersion"] = UIDevice.current.systemVersion
        diag["deviceModel"] = UIDevice.current.model
        diag["bundleId"] = Bundle.main.bundleIdentifier ?? "unknown"

        // Extension check in App.app/PlugIns/
        if let pluginsURL = Bundle.main.builtInPlugInsURL {
            do {
                let items = try FileManager.default.contentsOfDirectory(atPath: pluginsURL.path)
                diag["plugInsFound"] = items
                diag["hasWidgetExtension"] = items.contains(where: { $0.contains("NewKetWidgetExtension") })
            } catch {
                diag["plugInsFound"] = []
                diag["plugInsError"] = error.localizedDescription
                diag["hasWidgetExtension"] = false
            }
        } else {
            diag["plugInsFound"] = []
            diag["hasWidgetExtension"] = false
        }

        if #available(iOS 16.1, *) {
            let authInfo = ActivityAuthorizationInfo()
            diag["activityKitSupported"] = true
            diag["areActivitiesEnabled"] = authInfo.areActivitiesEnabled
            if #available(iOS 16.2, *) {
                diag["frequentPushesEnabled"] = authInfo.frequentPushesEnabled
            } else {
                diag["frequentPushesEnabled"] = false
            }

            let allActivities = Activity<OrderTrackingAttributes>.activities
            diag["activeActivitiesCount"] = allActivities.count
            diag["activeActivities"] = allActivities.map { act in
                let currentStatus: String
                if #available(iOS 16.2, *) {
                    currentStatus = act.content.state.status
                } else {
                    currentStatus = act.contentState.status
                }
                return [
                    "id": act.id,
                    "orderId": act.attributes.orderId,
                    "orderNumber": act.attributes.orderNumber,
                    "status": currentStatus,
                    "activityState": "\(act.activityState)"
                ]
            }
        } else {
            diag["activityKitSupported"] = false
            diag["areActivitiesEnabled"] = false
            diag["frequentPushesEnabled"] = false
            diag["activeActivitiesCount"] = 0
            diag["activeActivities"] = []
        }

        Self.logLock.lock()
        diag["nativeLogs"] = Self.diagnosticLogs
        Self.logLock.unlock()

        Self.logEvent(tag: "DIAG", message: "Diagnostics exported to JS")
        call.resolve(diag)
    }

    // MARK: - triggerHaptic
    /// Produit un micro-clic haptique Taptic Engine authentique d'Apple
    @objc func triggerHaptic(_ call: CAPPluginCall) {
        let styleStr = call.getString("style", "light")
        DispatchQueue.main.async {
            switch styleStr {
            case "medium":
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.prepare()
                generator.impactOccurred()
            case "heavy":
                let generator = UIImpactFeedbackGenerator(style: .heavy)
                generator.prepare()
                generator.impactOccurred()
            default:
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.prepare()
                generator.impactOccurred()
            }
            call.resolve()
        }
    }
}
