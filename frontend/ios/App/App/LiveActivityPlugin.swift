import Foundation
import Capacitor
import ActivityKit

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin {
    
    @available(iOS 16.1, *)
    private var currentActivity: Activity<TrackingAttributes>?
    
    @objc func startActivity(_ call: CAPPluginCall) {
        if #available(iOS 16.1, *) {
            let title = call.getString("title") ?? "NewKet"
            let entityId = call.getString("entityId") ?? ""
            let icon = call.getString("icon") ?? "📦"
            
            let statusTitle = call.getString("statusTitle") ?? "En cours"
            let statusDescription = call.getString("statusDescription") ?? ""
            let progress = call.getDouble("progress") ?? 0.0
            
            let attributes = TrackingAttributes(title: title, entityId: entityId, icon: icon)
            let contentState = TrackingAttributes.ContentState(statusTitle: statusTitle, statusDescription: statusDescription, progress: progress)
            
            do {
                if #available(iOS 16.2, *) {
                    let content = ActivityContent(state: contentState, staleDate: nil)
                    currentActivity = try Activity.request(
                        attributes: attributes,
                        content: content,
                        pushType: nil
                    )
                } else {
                    currentActivity = try Activity.request(
                        attributes: attributes,
                        contentState: contentState,
                        pushType: nil
                    )
                }
                call.resolve(["success": true])
            } catch {
                call.reject("Impossible de démarrer la Live Activity", error.localizedDescription)
            }
        } else {
            call.reject("Les Live Activities nécessitent iOS 16.1 ou plus récent.")
        }
    }
    
    @objc func updateActivity(_ call: CAPPluginCall) {
        if #available(iOS 16.1, *) {
            guard let activity = currentActivity else {
                call.reject("Aucune activité en cours")
                return
            }
            
            let statusTitle = call.getString("statusTitle") ?? "Mise à jour"
            let statusDescription = call.getString("statusDescription") ?? ""
            let progress = call.getDouble("progress") ?? 0.0
            
            let contentState = TrackingAttributes.ContentState(statusTitle: statusTitle, statusDescription: statusDescription, progress: progress)
            
            Task {
                if #available(iOS 16.2, *) {
                    let content = ActivityContent(state: contentState, staleDate: nil)
                    await activity.update(content)
                } else {
                    await activity.update(using: contentState)
                }
                call.resolve(["success": true])
            }
        } else {
            call.reject("Non supporté")
        }
    }
    
    @objc func endActivity(_ call: CAPPluginCall) {
        if #available(iOS 16.1, *) {
            guard let activity = currentActivity else {
                call.resolve(["success": true])
                return
            }
            
            Task {
                if #available(iOS 16.2, *) {
                    await activity.end(nil, dismissalPolicy: .immediate)
                } else {
                    await activity.end(using: nil, dismissalPolicy: .immediate)
                }
                currentActivity = nil
                call.resolve(["success": true])
            }
        } else {
            call.reject("Non supporté")
        }
    }
}
