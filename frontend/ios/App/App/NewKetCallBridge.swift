import Foundation
import WebKit

// ─────────────────────────────────────────────────────────────────────────────
// NewKetCallBridge
// Bridges the native CallKit answer event to the JavaScript WebView layer.
// Sets localStorage flags + dispatches 'newket:native_call_answered' so
// call-notifier.js can click the WebRTC answer button.
// ─────────────────────────────────────────────────────────────────────────────

@objc class NewKetCallBridge: NSObject {

    @objc static let shared = NewKetCallBridge()
    private override init() {}

    /// Called by NewKetCallProvider when the user taps Answer in CallKit UI.
    /// We walk the view hierarchy to find the WKWebView owned by Capacitor.
    @objc func notifyCallAnswered(orderId: String, callerName: String) {
        guard let webView = findCapacitorWebView() else {
            // App not in foreground yet — store in UserDefaults, pick up on launch
            let defaults = UserDefaults.standard
            defaults.set(orderId, forKey: "nk_pending_call_order_id")
            defaults.set(callerName, forKey: "nk_pending_call_caller")
            defaults.set(true, forKey: "nk_pending_call_answer")
            return
        }
        injectAnswerScript(into: webView, orderId: orderId, callerName: callerName)
    }

    /// Called by SceneDelegate on willConnectTo / scene:openURLContexts
    /// to flush any pending call that was answered while app was launching.
    @objc func flushPendingCallIfNeeded() {
        let defaults = UserDefaults.standard
        guard defaults.bool(forKey: "nk_pending_call_answer"),
              let orderId = defaults.string(forKey: "nk_pending_call_order_id")
        else { return }

        // Clear flags immediately
        defaults.removeObject(forKey: "nk_pending_call_answer")
        defaults.removeObject(forKey: "nk_pending_call_order_id")
        defaults.removeObject(forKey: "nk_pending_call_caller")

        guard let webView = findCapacitorWebView() else { return }
        // Give the WebView 1.5 s to finish loading before injecting
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            self.injectAnswerScript(into: webView, orderId: orderId, callerName: "")
        }
    }

    // MARK: - Private helpers

    private func injectAnswerScript(into webView: WKWebView, orderId: String, callerName: String) {
        let safeOrderId    = orderId.replacingOccurrences(of: "'", with: "\\'")
        let safeCallerName = callerName.replacingOccurrences(of: "'", with: "\\'")

        let js = """
        (function() {
          try {
            localStorage.setItem('nk_auto_open_order_id', '\(safeOrderId)');
            localStorage.setItem('nk_auto_open_chat', '1');
            localStorage.setItem('nk_auto_answer_call', '1');
            window.dispatchEvent(new CustomEvent('newket:native_call_answered', {
              detail: { orderId: '\(safeOrderId)', callerName: '\(safeCallerName)' }
            }));
          } catch(e) {}
        })();
        """
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    /// Walk the key window's view hierarchy to find WKWebView.
    private func findCapacitorWebView() -> WKWebView? {
        guard let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first,
              let window = scene.windows.first(where: { $0.isKeyWindow })
        else { return nil }
        return findWebView(in: window)
    }

    private func findWebView(in view: UIView) -> WKWebView? {
        if let wk = view as? WKWebView { return wk }
        for sub in view.subviews {
            if let found = findWebView(in: sub) { return found }
        }
        return nil
    }
}
