import UIKit
import SwiftUI
import Capacitor

open class NewKetBridgeViewController: CAPBridgeViewController {
    public weak var nativeTabCoordinator: NativeTabCoordinator?

    override open func viewDidLoad() {
        super.viewDidLoad()
        // Swipe-to-back gesture natif iOS
        webView?.allowsBackForwardNavigationGestures = true

        // Edge-to-edge : la WebView s'étend full-screen, safe-area gérée en CSS.
        // Le TabView SwiftUI natif s'occupe de l'inset du bas.
        if let webView = webView {
            webView.scrollView.contentInsetAdjustmentBehavior = .never
        }
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(LiveActivityPlugin())
        bridge?.registerPluginInstance(AdminNavbarPlugin())
        bridge?.registerPluginInstance(NativeHeaderButtonsPlugin())
        let tabPlugin = NativeTabBarPlugin()
        tabPlugin.coordinator = nativeTabCoordinator
        nativeTabCoordinator?.plugin = tabPlugin
        bridge?.registerPluginInstance(tabPlugin)
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var coordinator: NativeTabCoordinator?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // ── Native SwiftUI TabView (Liquid Glass automatique sur iOS 26) ──────
        // Le même BridgeViewController est partagé entre tous les onglets.
        // Le TabView SwiftUI navigue la WebView en temps réel (window.location.href).
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
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                self?.coordinator?.handleDeepLink(url: launchUrl)
            }
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
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
}
