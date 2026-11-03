import UIKit
import SwiftUI
import Capacitor
import WidgetKit
import WebKit

open class NewKetBridgeViewController: CAPBridgeViewController, WKNavigationDelegate {
    public weak var nativeTabCoordinator: NativeTabCoordinator?
    public weak var headerButtonsPlugin: NativeHeaderButtonsPlugin?

    // We chain the original Capacitor navigation delegate so its logic still runs
    private weak var capacitorNavigationDelegate: WKNavigationDelegate?
    // Whether we intercepted a back-forward navigation (swipe-back)
    private var swipeNavigationInProgress: Bool = false

    override open func viewDidLoad() {
        super.viewDidLoad()
        // Swipe-to-back gesture natif iOS
        webView?.allowsBackForwardNavigationGestures = true

        // Edge-to-edge : la WebView s'etend full-screen, safe-area geree en CSS.
        // Le TabView SwiftUI natif s'occupe de l'inset du bas.
        if let webView = webView {
            webView.scrollView.contentInsetAdjustmentBehavior = .never
            // Chain navigation delegate: save Capacitor's delegate, then take over
            self.capacitorNavigationDelegate = webView.navigationDelegate
            webView.navigationDelegate = self
        }
    }

    // MARK: - WKNavigationDelegate (swipe-back interception)

    // Called BEFORE any JS runs on the destination page — perfect timing to freeze Y's buttons
    public func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        // swipeNavigationInProgress is set in decidePolicyFor when navigationType == .backForward
        capacitorNavigationDelegate?.webView?(webView, didStartProvisionalNavigation: navigation)
    }

    public func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        capacitorNavigationDelegate?.webView?(webView, didCommit: navigation)
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if swipeNavigationInProgress {
            swipeNavigationInProgress = false
            headerButtonsPlugin?.endInteractiveSwipe(committed: true)
        }
        capacitorNavigationDelegate?.webView?(webView, didFinish: navigation)
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if swipeNavigationInProgress {
            swipeNavigationInProgress = false
            headerButtonsPlugin?.endInteractiveSwipe(committed: false)
        }
        capacitorNavigationDelegate?.webView?(webView, didFail: navigation, withError: error)
    }

    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if swipeNavigationInProgress {
            swipeNavigationInProgress = false
            headerButtonsPlugin?.endInteractiveSwipe(committed: false)
        }
        capacitorNavigationDelegate?.webView?(webView, didFailProvisionalNavigation: navigation, withError: error)
    }

    // Forward decidePolicyFor and detect back-forward navigation (swipe-back) BEFORE JS runs on destination
    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // .backForward = user swiped back (or forward) — intercept IMMEDIATELY before Z's pageshow fires
        if navigationAction.navigationType == .backForward && !swipeNavigationInProgress {
            swipeNavigationInProgress = true
            headerButtonsPlugin?.beginInteractiveSwipe()
        }
        if let cap = capacitorNavigationDelegate, cap.responds(to: #selector(webView(_:decidePolicyFor:decisionHandler:) as (WKWebView, WKNavigationAction, @escaping (WKNavigationActionPolicy) -> Void) -> Void)) {
            capacitorNavigationDelegate?.webView?(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler)
        } else {
            decisionHandler(.allow)
        }
    }

    public func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if let cap = capacitorNavigationDelegate, cap.responds(to: #selector(webView(_:decidePolicyFor:decisionHandler:) as (WKWebView, WKNavigationResponse, @escaping (WKNavigationResponsePolicy) -> Void) -> Void)) {
            capacitorNavigationDelegate?.webView?(webView, decidePolicyFor: navigationResponse, decisionHandler: decisionHandler)
        } else {
            decisionHandler(.allow)
        }
    }

    // MARK: - Capacitor Plugin Registration

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(LiveActivityPlugin())
        bridge?.registerPluginInstance(AdminNavbarPlugin())
        let headerPlugin = NativeHeaderButtonsPlugin()
        bridge?.registerPluginInstance(headerPlugin)
        self.headerButtonsPlugin = headerPlugin
        let tabPlugin = NativeTabBarPlugin()
        tabPlugin.coordinator = nativeTabCoordinator
        nativeTabCoordinator?.plugin = tabPlugin
        bridge?.registerPluginInstance(tabPlugin)
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var coordinator: NativeTabCoordinator?
    private static var lastWidgetReloadDate: Date?

    /// Throttled widget refresh: reloads at most once every 15 minutes when app is opened
    private func reloadWidgetsIfNeeded() {
        let now = Date()
        if let last = Self.lastWidgetReloadDate, now.timeIntervalSince(last) < 15 * 60 {
            return
        }
        Self.lastWidgetReloadDate = now
        WidgetCenter.shared.reloadAllTimelines()
    }

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // ÔöÇÔöÇ Native SwiftUI TabView (Liquid Glass automatique sur iOS 26) ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
        // Le m├¬me BridgeViewController est partag├® entre tous les onglets.
        // Le TabView SwiftUI navigue la WebView en temps r├®el (window.location.href).
        let bridgeVC = NewKetBridgeViewController()
        let coordinator = NativeTabCoordinator(bridgeVC: bridgeVC)
        bridgeVC.nativeTabCoordinator = coordinator

        let rootView = NativeTabRootView(bridgeVC: bridgeVC, coordinator: coordinator)
        let hostingVC = UIHostingController(rootView: rootView)
        hostingVC.view.backgroundColor = .systemBackground

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = hostingVC
        window?.makeKeyAndVisible()

        // Store coordinator reference for deep link forwarding
        self.coordinator = coordinator

        // Cold-start deep link (app was closed, widget button tapped)
        if let launchUrl = connectionOptions.urlContexts.first?.url {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
                self?.coordinator?.handleDeepLink(url: launchUrl)
            }
        }

        // Cold-start Quick Action (app was closed, icon long-pressed)
        if let shortcutItem = connectionOptions.shortcutItem {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
                self?.handleShortcutItem(shortcutItem)
            }
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        reloadWidgetsIfNeeded()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        reloadWidgetsIfNeeded()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // Warm-resume deep link (app already running, widget button tapped)
        for context in URLContexts {
            coordinator?.handleDeepLink(url: context.url)
        }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        handleShortcutItem(shortcutItem)
        completionHandler(true)
    }

    private func handleShortcutItem(_ item: UIApplicationShortcutItem) {
        switch item.type {
        case "cd.newket.app.home":
            coordinator?.handleDeepLink(url: URL(string: "newket://home")!)
        case "cd.newket.app.search":
            coordinator?.handleDeepLink(url: URL(string: "newket://search")!)
        case "cd.newket.app.shops":
            coordinator?.handleDeepLink(url: URL(string: "newket://shops")!)
        case "cd.newket.app.account":
            coordinator?.handleDeepLink(url: URL(string: "newket://account")!)
        default:
            break
        }
    }
}
