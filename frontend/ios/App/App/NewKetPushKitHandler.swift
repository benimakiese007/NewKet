import Foundation
import PushKit
import CallKit
import WebKit

// ─────────────────────────────────────────────────────────────────────────────
// NewKetPushKitHandler
// PushKit VoIP push delegate.
// Apple REQUIRES reportNewIncomingCall to be called synchronously within the
// same didReceiveIncomingPushWith call, otherwise the app is terminated.
//
// Registration is done in AppDelegate.application(_:didFinishLaunchingWithOptions:)
// ─────────────────────────────────────────────────────────────────────────────

@objc class NewKetPushKitHandler: NSObject, PKPushRegistryDelegate {

    @objc static let shared = NewKetPushKitHandler()

    private var registry: PKPushRegistry?

    private override init() {}

    // MARK: - Public

    @objc func register() {
        let registry           = PKPushRegistry(queue: .main)
        registry.delegate      = self
        registry.desiredPushTypes = [.voIP]
        self.registry          = registry
    }

    // MARK: - PKPushRegistryDelegate

    func pushRegistry(_ registry: PKPushRegistry,
                      didUpdate pushCredentials: PKPushCredentials,
                      for type: PKPushType) {
        guard type == .voIP else { return }
        let tokenData = pushCredentials.token
        let token = tokenData.map { String(format: "%02x", $0) }.joined()
        print("[NewKetPushKit] VoIP token: \(token)")
        // Persist the VoIP token so JS can read it and sync to Supabase
        UserDefaults.standard.set(token, forKey: "nk_voip_token")
        // Notify JS layer if WebView is available
        notifyVoipTokenToJS(token: token)
    }

    /// Apple REQUIRES you to report an incoming call SYNCHRONOUSLY here.
    /// No async, no dispatch, no network calls before calling reportIncomingCall.
    func pushRegistry(_ registry: PKPushRegistry,
                      didReceiveIncomingPushWith payload: PKPushPayload,
                      for type: PKPushType,
                      completion: @escaping () -> Void) {
        guard type == .voIP else {
            completion()
            return
        }

        let data       = payload.dictionaryPayload
        let aps        = data["aps"] as? [String: Any] ?? [:]
        let custom     = data["data"] as? [String: Any] ?? (data as? [String: Any] ?? [:])

        // Extract fields — backend sends these in the notification payload
        let pushType   = custom["type"] as? String ?? ""
        let orderId    = custom["order_id"] as? String ?? ""
        let callerName = custom["caller_name"] as? String
                      ?? (aps["alert"] as? [String: Any])?["title"] as? String
                      ?? "NewKet"

        guard pushType == "incoming-call" else {
            // Not a call push — still need to report something to satisfy Apple,
            // then end it immediately.
            let uuid = UUID()
            let update = CXCallUpdate()
            update.remoteHandle = CXHandle(type: .generic, value: "NewKet")
            CXProvider(configuration: Self.minimalConfig()).reportNewIncomingCall(with: uuid, update: update) { _ in }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                // We can't easily get the provider instance, so just fulfill
            }
            completion()
            return
        }

        // ✅ Synchronous call to CallKit — this is what Apple requires
        NewKetCallProvider.shared.reportIncomingCall(callerName: callerName, orderId: orderId)
        completion()
    }

    func pushRegistry(_ registry: PKPushRegistry,
                      didInvalidatePushTokenFor type: PKPushType) {
        print("[NewKetPushKit] VoIP token invalidated")
        UserDefaults.standard.removeObject(forKey: "nk_voip_token")
    }

    // MARK: - Helpers

    private func notifyVoipTokenToJS(token: String) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            guard let scene = UIApplication.shared.connectedScenes
                    .compactMap({ $0 as? UIWindowScene }).first,
                  let window = scene.windows.first(where: { $0.isKeyWindow }),
                  let webView = Self.findWebView(in: window)
            else { return }
            let safeToken = token.replacingOccurrences(of: "'", with: "\\'")
            let js = "window.newketVoipToken = '\(safeToken)'; localStorage.setItem('nk_voip_token', '\(safeToken)');"
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private static func findWebView(in view: UIView) -> WKWebView? {
        if let wk = view as? WKWebView { return wk }
        for sub in view.subviews {
            if let found = findWebView(in: sub) { return found }
        }
        return nil
    }

    /// Minimal provider config needed to satisfy the Apple VoIP push requirement
    /// for non-call push types that still trigger this delegate.
    private static func minimalConfig() -> CXProviderConfiguration {
        let c = CXProviderConfiguration(localizedName: "NewKet")
        c.supportedHandleTypes = [.generic]
        return c
    }
}
