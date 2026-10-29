import UIKit
import SwiftUI
import Capacitor

// MARK: - Tab definitions (mirrors JS navigation)

/// Definition of a single tab item in the native SwiftUI TabView.
public struct TabItem: Identifiable, Hashable {
    public let id: String       // e.g. "home", "catalog", "shops", "cart", "account"
    public let label: String
    public let systemImage: String
    public let path: String
}

extension TabItem {
    /// Default consumer tabs (Capacitor physical file paths)
    public static let defaultTabs: [TabItem] = [
        TabItem(id: "home",    label: "Accueil",   systemImage: "house",          path: "/index.html"),
        TabItem(id: "catalog", label: "Catalogue", systemImage: "square.grid.2x2", path: "/src/pages/catalog.html"),
        TabItem(id: "shops",   label: "Boutiques", systemImage: "bag",            path: "/src/pages/shops.html"),
        TabItem(id: "cart",    label: "Panier",    systemImage: "cart",           path: "##cart"),
        TabItem(id: "account", label: "Compte",    systemImage: "person",         path: "/src/pages/customer-dashboard.html"),
    ]

    /// Seller tabs (replaces Boutiques with Vendre)
    public static let sellerTabs: [TabItem] = [
        TabItem(id: "home",    label: "Accueil",   systemImage: "house",          path: "/index.html"),
        TabItem(id: "catalog", label: "Catalogue", systemImage: "square.grid.2x2", path: "/src/pages/catalog.html"),
        TabItem(id: "sell",    label: "Vendre",    systemImage: "plus.circle",    path: "/src/pages/publish.html"),
        TabItem(id: "cart",    label: "Panier",    systemImage: "cart",           path: "##cart"),
        TabItem(id: "account", label: "Compte",    systemImage: "person",         path: "/src/pages/vendor-dashboard.html"),
    ]
}

// MARK: - Capacitor Plugin

@objc(NativeTabBarPlugin)
public class NativeTabBarPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "NativeTabBarPlugin"
    public let jsName = "NativeTabBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setActiveTab",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setRole",       returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBadge",      returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearBadge",    returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show",          returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide",          returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setProfile",    returnType: CAPPluginReturnPromise),
    ]

    public weak var coordinator: NativeTabCoordinator?

    @objc func show(_ call: CAPPluginCall) {
        let animated = call.getBool("animated") ?? true
        DispatchQueue.main.async {
            self.coordinator?.setTabBarHidden(false, animated: animated)
        }
        call.resolve(["hidden": false])
    }

    @objc func hide(_ call: CAPPluginCall) {
        let animated = call.getBool("animated") ?? true
        DispatchQueue.main.async {
            self.coordinator?.setTabBarHidden(true, animated: animated)
        }
        call.resolve(["hidden": true])
    }

    @objc func setActiveTab(_ call: CAPPluginCall) {
        guard let tabId = call.getString("tabId") else {
            call.reject("tabId required"); return
        }
        DispatchQueue.main.async {
            self.coordinator?.selectTab(id: tabId)
        }
        call.resolve()
    }

    @objc func setRole(_ call: CAPPluginCall) {
        guard let role = call.getString("role") else {
            call.reject("role required"); return
        }
        DispatchQueue.main.async {
            self.coordinator?.applyRole(role)
        }
        call.resolve()
    }

    @objc func setBadge(_ call: CAPPluginCall) {
        guard let tabId = call.getString("tabId"),
              let count = call.getInt("count") else {
            call.reject("tabId and count required"); return
        }
        DispatchQueue.main.async {
            self.coordinator?.setBadge(tabId: tabId, count: count)
        }
        call.resolve()
    }

    @objc func clearBadge(_ call: CAPPluginCall) {
        guard let tabId = call.getString("tabId") else {
            call.reject("tabId required"); return
        }
        DispatchQueue.main.async {
            self.coordinator?.setBadge(tabId: tabId, count: 0)
        }
        call.resolve()
    }

    @objc func setProfile(_ call: CAPPluginCall) {
        let isLoggedIn = call.getBool("isLoggedIn") ?? false
        let avatarUrl = call.getString("avatarUrl")
        let initials = call.getString("initials")
        let role = call.getString("role")

        DispatchQueue.main.async {
            self.coordinator?.updateProfile(isLoggedIn: isLoggedIn, avatarUrl: avatarUrl, initials: initials, role: role)
        }
        call.resolve()
    }

    func notifyTabChanged(tabId: String) {
        notifyListeners("tabChanged", data: ["tabId": tabId])
    }
}

// MARK: - Observable Coordinator (SwiftUI ↔ Capacitor bridge)

@MainActor
public final class NativeTabCoordinator: ObservableObject {

    @Published public var tabs: [TabItem] = TabItem.defaultTabs
    @Published public var selectedTabId: String = "home"
    @Published public var badges: [String: Int] = [:]
    @Published public var isTabBarHidden: Bool = true

    // User profile avatar & initials (Instagram / Apple HIG style)
    @Published public var isLoggedIn: Bool = false
    @Published public var avatarImage: UIImage? = nil
    @Published public var initialsImage: UIImage? = nil
    private var lastLoadedAvatarUrl: String? = nil

    public weak var plugin: NativeTabBarPlugin?
    public weak var bridgeVC: NewKetBridgeViewController?

    public init(bridgeVC: NewKetBridgeViewController? = nil) {
        self.bridgeVC = bridgeVC
    }

    public func onTabSelected(id: String) {

        guard let tab = tabs.first(where: { $0.id == id }) else { return }

        if tab.path == "##cart" {
            // Trigger cart drawer via JS without changing active page
            let cartJs = """
            if (window.CartManager && typeof window.CartManager.toggleCartUI === 'function') {
                window.CartManager.toggleCartUI();
            } else {
                window.location.href = '/src/pages/customer-dashboard.html';
            }
            """
            bridgeVC?.bridge?.webView?.evaluateJavaScript(cartJs, completionHandler: nil)
            return
        }

        selectedTabId = id
        plugin?.notifyTabChanged(tabId: id)

        let targetPath = tab.path
        let js = """
        (function() {
            var target = '\(targetPath)';
            var curr = window.location.pathname;
            var isSame = (curr === target) || (target === '/index.html' && (curr === '/' || curr === '' || curr.endsWith('/index.html')));
            if (!isSame) {
                window.location.href = target;
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        })();
        """
        bridgeVC?.bridge?.webView?.evaluateJavaScript(js) { _, err in
            if let err = err {
                print("[NativeTabBar] Navigation error: \(err)")
            }
        }
    }

    public func selectTab(id: String) {
        if id.isEmpty || !tabs.contains(where: { $0.id == id }) {
            selectedTabId = ""
            return
        }
        selectedTabId = id
    }

    /// Handles deep links from iOS Home Screen Widgets & Live Activities directly in native Swift.
    /// Synchronizes both the SwiftUI TabView state and the WKWebView navigation cleanly.
    public func handleDeepLink(url: URL) {
        let urlStr = url.absoluteString.lowercased()
        guard urlStr.starts(with: "newket://") else { return }

        let route = urlStr.replacingOccurrences(of: "newket://", with: "")
            .components(separatedBy: "?")[0]
            .components(separatedBy: "#")[0]
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        let urlComponents = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let productId = urlComponents?.queryItems?.first(where: { $0.name.lowercased() == "id" })?.value

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            switch route {
            case "product", "produit":
                if let id = productId, !id.isEmpty {
                    let js = """
                    (function() {
                        window.location.href = '/src/pages/product.html?id=\(id)';
                    })();
                    """
                    self.bridgeVC?.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)
                } else {
                    self.onTabSelected(id: "catalog")
                }

            case "shops", "shop", "boutique", "boutiques":
                if self.tabs.contains(where: { $0.id == "shops" }) {
                    self.selectedTabId = "shops"
                    self.plugin?.notifyTabChanged(tabId: "shops")
                }
                let js = """
                (function() {
                    if (!window.location.pathname.includes('shops.html')) {
                        window.location.href = '/src/pages/shops.html';
                    } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                })();
                """
                self.bridgeVC?.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)

            case "search", "recherche":
                self.selectedTabId = "catalog"
                self.plugin?.notifyTabChanged(tabId: "catalog")
                let js = """
                (function() {
                    var sc = document.getElementById('mobileSearchContainer');
                    if (sc) {
                        sc.classList.remove('user-hidden-on-mobile');
                        setTimeout(function() {
                            var input = document.getElementById('searchInput');
                            if (input) { input.focus(); }
                        }, 100);
                    }
                    if (!window.location.pathname.includes('catalog.html')) {
                        window.location.href = '/src/pages/catalog.html?open=search';
                    }
                })();
                """
                self.bridgeVC?.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)

            case "home", "accueil":
                self.onTabSelected(id: "home")

            case "cart", "panier", "achat":
                self.onTabSelected(id: "cart")

            case "notifications", "notif", "notifs":
                let js = """
                (function() {
                    if (window.DrawersManager && typeof window.DrawersManager.openNotifications === 'function') {
                        window.DrawersManager.openNotifications();
                    } else if (window.NotificationManager && typeof window.NotificationManager.openUI === 'function') {
                        window.NotificationManager.openUI();
                    }
                })();
                """
                self.bridgeVC?.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)

            case "favorites", "fav", "favoris":
                let js = """
                (function() {
                    if (window.DrawersManager && typeof window.DrawersManager.openFavorites === 'function') {
                        window.DrawersManager.openFavorites();
                    } else if (window.FavoritesManager && typeof window.FavoritesManager.openUI === 'function') {
                        window.FavoritesManager.openUI();
                    }
                })();
                """
                self.bridgeVC?.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)

            case "account", "compte", "dashboard":
                self.onTabSelected(id: "account")

            default:
                self.onTabSelected(id: "home")
            }
        }
    }

    public func applyRole(_ role: String) {
        let isSeller = role == "seller" || role == "supplier"
        tabs = isSeller ? TabItem.sellerTabs : TabItem.defaultTabs
        if !tabs.contains(where: { $0.id == selectedTabId }) {
            selectedTabId = "home"
        }
    }

    public func setBadge(tabId: String, count: Int) {
        badges[tabId] = count > 0 ? count : nil
    }

    public func setTabBarHidden(_ hidden: Bool, animated: Bool = true) {
        if isTabBarHidden == hidden { return }
        if animated {
            withAnimation(.easeInOut(duration: 0.25)) {
                self.isTabBarHidden = hidden
            }
        } else {
            self.isTabBarHidden = hidden
        }
        if let tabVC = bridgeVC?.tabBarController {
            if animated {
                UIView.animate(withDuration: 0.25) {
                    tabVC.tabBar.alpha = hidden ? 0 : 1
                    tabVC.tabBar.isHidden = hidden
                }
            } else {
                tabVC.tabBar.alpha = hidden ? 0 : 1
                tabVC.tabBar.isHidden = hidden
            }
        }
    }

    // MARK: - Avatar & Initials Support (Apple HIG / Liquid Glass)

    public func updateProfile(isLoggedIn: Bool, avatarUrl: String?, initials: String?, role: String?) {
        self.isLoggedIn = isLoggedIn

        if let role = role {
            applyRole(role)
        }

        guard isLoggedIn else {
            self.avatarImage = nil
            self.initialsImage = nil
            self.lastLoadedAvatarUrl = nil
            return
        }

        let cleanInitials = (initials?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "").prefix(2).uppercased()
        let displayInitials = cleanInitials.isEmpty ? "U" : String(cleanInitials)
        self.initialsImage = NativeTabCoordinator.generateInitialsImage(initials: displayInitials)

        guard let urlStr = avatarUrl, !urlStr.isEmpty, let url = URL(string: urlStr) else {
            self.avatarImage = nil
            self.lastLoadedAvatarUrl = nil
            return
        }

        if urlStr == lastLoadedAvatarUrl && self.avatarImage != nil {
            return
        }

        self.lastLoadedAvatarUrl = urlStr
        Task { [weak self] in
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                if let rawImage = UIImage(data: data),
                   let circular = NativeTabCoordinator.generateCircularAvatar(from: rawImage) {
                    await MainActor.run {
                        if self?.lastLoadedAvatarUrl == urlStr {
                            self?.avatarImage = circular
                        }
                    }
                }
            } catch {
                // Keep initials on failure
            }
        }
    }

    public static func generateCircularAvatar(from image: UIImage, size: CGFloat = 26.0) -> UIImage? {
        let rect = CGRect(x: 0, y: 0, width: size, height: size)
        let format = UIGraphicsImageRendererFormat()
        let renderer = UIGraphicsImageRenderer(size: rect.size, format: format)

        let circular = renderer.image { _ in
            let path = UIBezierPath(ovalIn: rect)
            path.addClip()

            let aspectWidth = size / image.size.width
            let aspectHeight = size / image.size.height
            let scale = max(aspectWidth, aspectHeight)
            let scaledWidth = image.size.width * scale
            let scaledHeight = image.size.height * scale
            let originX = (size - scaledWidth) / 2.0
            let originY = (size - scaledHeight) / 2.0

            image.draw(in: CGRect(x: originX, y: originY, width: scaledWidth, height: scaledHeight))

            UIColor.white.withAlphaComponent(0.6).setStroke()
            let borderPath = UIBezierPath(ovalIn: rect.insetBy(dx: 0.5, dy: 0.5))
            borderPath.lineWidth = 1.0
            borderPath.stroke()
        }

        return circular.withRenderingMode(.alwaysOriginal)
    }

    public static func generateInitialsImage(initials: String, size: CGFloat = 26.0) -> UIImage? {
        let rect = CGRect(x: 0, y: 0, width: size, height: size)
        let format = UIGraphicsImageRendererFormat()
        let renderer = UIGraphicsImageRenderer(size: rect.size, format: format)

        let img = renderer.image { _ in
            let path = UIBezierPath(ovalIn: rect)
            UIColor(red: 0.18, green: 0.22, blue: 0.32, alpha: 1.0).setFill()
            path.fill()

            UIColor.white.withAlphaComponent(0.5).setStroke()
            let borderPath = UIBezierPath(ovalIn: rect.insetBy(dx: 0.5, dy: 0.5))
            borderPath.lineWidth = 1.0
            borderPath.stroke()

            let font = UIFont.systemFont(ofSize: 10, weight: .bold)
            let attributes: [NSAttributedString.Key: Any] = [
                .font: font,
                .foregroundColor: UIColor.white
            ]
            let textSize = initials.size(withAttributes: attributes)
            let textRect = CGRect(
                x: (size - textSize.width) / 2.0,
                y: (size - textSize.height) / 2.0,
                width: textSize.width,
                height: textSize.height
            )
            initials.draw(in: textRect, withAttributes: attributes)
        }

        return img.withRenderingMode(.alwaysOriginal)
    }
}

// MARK: - Full Native SwiftUI TabView (Liquid Glass on iOS 26)

public struct NativeTabRootView: View {

    @ObservedObject public var coordinator: NativeTabCoordinator
    public let bridgeVC: NewKetBridgeViewController

    public init(bridgeVC: NewKetBridgeViewController, coordinator: NativeTabCoordinator) {
        self.bridgeVC = bridgeVC
        self.coordinator = coordinator
    }

    @ViewBuilder
    private func tabLabel(for tab: TabItem) -> some View {
        if tab.id == "account" && coordinator.isLoggedIn {
            if let avatar = coordinator.avatarImage {
                Image(uiImage: avatar)
                    .renderingMode(.original)
            } else if let initials = coordinator.initialsImage {
                Image(uiImage: initials)
                    .renderingMode(.original)
            } else {
                Image(systemName: "person.crop.circle.fill")
            }
            Text(tab.label)
        } else {
            Label(tab.label, systemImage: tab.systemImage)
        }
    }

    public var body: some View {
        Group {
            if #available(iOS 18.0, *) {
                // Modern SwiftUI TabView syntax — native Liquid Glass on iOS 26
                TabView(selection: Binding(
                    get: { coordinator.selectedTabId },
                    set: { newId in coordinator.onTabSelected(id: newId) }
                )) {
                    ForEach(coordinator.tabs) { tab in
                        Tab(value: tab.id) {
                            CapacitorWebViewRepresentable(bridgeVC: bridgeVC)
                                .ignoresSafeArea()
                                .toolbar(coordinator.isTabBarHidden ? .hidden : .visible, for: .tabBar)
                        } label: {
                            tabLabel(for: tab)
                        }
                        .badge(coordinator.badges[tab.id] ?? 0)
                    }
                }
                .toolbar(coordinator.isTabBarHidden ? .hidden : .visible, for: .tabBar)
                .tint(Color(red: 0.12, green: 0.16, blue: 0.22)) // Anthracite NewKet Header
            } else if #available(iOS 16.0, *) {
                // Fallback for iOS 16-17
                TabView(selection: Binding(
                    get: { coordinator.selectedTabId },
                    set: { newId in coordinator.onTabSelected(id: newId) }
                )) {
                    ForEach(coordinator.tabs) { tab in
                        CapacitorWebViewRepresentable(bridgeVC: bridgeVC)
                            .ignoresSafeArea()
                            .toolbar(coordinator.isTabBarHidden ? .hidden : .visible, for: .tabBar)
                            .tabItem {
                                tabLabel(for: tab)
                            }
                            .tag(tab.id)
                            .badge(coordinator.badges[tab.id] ?? 0)
                    }
                }
                .toolbar(coordinator.isTabBarHidden ? .hidden : .visible, for: .tabBar)
                .tint(Color(red: 0.12, green: 0.16, blue: 0.22)) // Anthracite NewKet Header
            } else {
                // Fallback for earlier iOS versions (< iOS 16)
                TabView(selection: Binding(
                    get: { coordinator.selectedTabId },
                    set: { newId in coordinator.onTabSelected(id: newId) }
                )) {
                    ForEach(coordinator.tabs) { tab in
                        CapacitorWebViewRepresentable(bridgeVC: bridgeVC)
                            .ignoresSafeArea()
                            .tabItem {
                                tabLabel(for: tab)
                            }
                            .tag(tab.id)
                    }
                }
                .tint(Color(red: 0.12, green: 0.16, blue: 0.22)) // Anthracite NewKet Header
            }
        }
        .animation(.easeInOut(duration: 0.25), value: coordinator.isTabBarHidden)
        .onAppear {
            coordinator.bridgeVC = bridgeVC
            if let plugin = bridgeVC.bridge?.plugin(withName: "NativeTabBarPlugin") as? NativeTabBarPlugin {
                plugin.coordinator = coordinator
                coordinator.plugin = plugin
            }
        }
    }
}

// MARK: - UIViewControllerRepresentable

public struct CapacitorWebViewRepresentable: UIViewControllerRepresentable {
    public let bridgeVC: NewKetBridgeViewController

    public init(bridgeVC: NewKetBridgeViewController) {
        self.bridgeVC = bridgeVC
    }

    public func makeUIViewController(context: Context) -> NewKetBridgeViewController {
        return bridgeVC
    }

    public func updateUIViewController(_ uiViewController: NewKetBridgeViewController, context: Context) {}
}
