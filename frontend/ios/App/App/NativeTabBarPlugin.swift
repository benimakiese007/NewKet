import UIKit
import Capacitor

// MARK: - Tab Model

private struct TabItem {
    let id: String
    let title: String
    let sfSymbol: String        // System symbol (inactive)
    let sfSymbolFill: String    // System symbol (active/filled)
    let url: String
}

// MARK: - Role-based Tab Configurations
// Mirrors the logic in components-loader.js getBottomNavHTML(role)

private enum UserRole: String {
    case guest    = "guest"
    case customer = "customer"
    case seller   = "seller"
    case supplier = "supplier"
    case admin    = "admin"
}

private func tabsForRole(_ roleString: String) -> [TabItem] {
    let role = UserRole(rawValue: roleString) ?? .guest
    let isSeller = role == .seller || role == .supplier
    let isAdmin  = role == .admin

    if isAdmin {
        // Admin browsing public store: same as customer, but without the cart (admin does not purchase)
        return [
            TabItem(id: "home",    title: "Accueil",   sfSymbol: "house",              sfSymbolFill: "house.fill",              url: "/"),
            TabItem(id: "search",  title: "Recherche", sfSymbol: "magnifyingglass",    sfSymbolFill: "magnifyingglass",          url: "#search"),
            TabItem(id: "shops",   title: "Boutique",  sfSymbol: "storefront",         sfSymbolFill: "storefront.fill",         url: "/src/pages/shops.html"),
            TabItem(id: "account", title: "Profil",    sfSymbol: "person.circle",      sfSymbolFill: "person.circle.fill",      url: "/src/pages/settings.html"),
        ]
    }

    if isSeller {
        // Seller: replace Shops with Publish CTA
        return [
            TabItem(id: "home",    title: "Accueil",   sfSymbol: "house",                           sfSymbolFill: "house.fill",                           url: "/"),
            TabItem(id: "search",  title: "Recherche", sfSymbol: "magnifyingglass",                  sfSymbolFill: "magnifyingglass",                       url: "#search"),
            TabItem(id: "sell",    title: "Publier",   sfSymbol: "plus.circle",                     sfSymbolFill: "plus.circle.fill",                     url: "/src/pages/publish.html"),
            TabItem(id: "cart",    title: "Panier",    sfSymbol: "cart",                            sfSymbolFill: "cart.fill",                            url: "#cart"),
            TabItem(id: "account", title: "Profil",    sfSymbol: "person.circle",                   sfSymbolFill: "person.circle.fill",                   url: "/src/pages/settings.html"),
        ]
    }

    // Guest or Customer: standard discovery tabs
    return [
        TabItem(id: "home",    title: "Accueil",   sfSymbol: "house",              sfSymbolFill: "house.fill",              url: "/"),
        TabItem(id: "search",  title: "Recherche", sfSymbol: "magnifyingglass",    sfSymbolFill: "magnifyingglass",          url: "#search"),
        TabItem(id: "shops",   title: "Boutique",  sfSymbol: "storefront",         sfSymbolFill: "storefront.fill",         url: "/src/pages/shops.html"),
        TabItem(id: "cart",    title: "Panier",    sfSymbol: "cart",               sfSymbolFill: "cart.fill",               url: "#cart"),
        TabItem(id: "account", title: "Profil",    sfSymbol: "person.circle",      sfSymbolFill: "person.circle.fill",      url: "/src/pages/settings.html"),
    ]
}

// MARK: - Plugin Declaration

@objc(NativeTabBarPlugin)
public class NativeTabBarPlugin: CAPPlugin {

    private var tabBarController: NativeTabBarController?

    // MARK: - isNativeAvailable
    @objc func isNativeAvailable(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            call.resolve(["available": true])
        } else {
            call.resolve(["available": false])
        }
    }

    // MARK: - show
    @objc func show(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else {
            call.resolve(["shown": false])
            return
        }

        let activeTab = call.getString("activeTab") ?? "home"
        let role      = call.getString("role")      ?? "guest"

        DispatchQueue.main.async { [weak self] in
            guard let self,
                  let viewController = self.bridge?.viewController,
                  let rootView = viewController.view else {
                call.reject("NativeTabBarPlugin: rootView not found")
                return
            }

            // Remove any existing instance
            self.tabBarController?.removeFromParent()
            self.tabBarController?.view.removeFromSuperview()
            self.tabBarController = nil

            let controller = NativeTabBarController(role: role)
            controller.translatesAutoresizingMaskIntoConstraints = false

            // Wire tab selection → JS event
            controller.onTabSelected = { [weak self] tabId, url in
                self?.notifyListeners("tabSelected", data: ["tab": tabId, "url": url])
            }

            rootView.addSubview(controller.view)
            viewController.addChild(controller)
            controller.didMove(toParent: viewController)

            NSLayoutConstraint.activate([
                controller.view.leadingAnchor.constraint(equalTo: rootView.leadingAnchor),
                controller.view.trailingAnchor.constraint(equalTo: rootView.trailingAnchor),
                controller.view.bottomAnchor.constraint(equalTo: rootView.bottomAnchor)
            ])

            self.tabBarController = controller
            controller.setActiveTab(id: activeTab)

            // Push WebView content up so it doesn't hide under the tab bar
            self.adjustWebViewInset(rootView: rootView)

            call.resolve(["shown": true])
        }
    }

    // MARK: - hide
    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.tabBarController?.view.removeFromSuperview()
            self.tabBarController?.removeFromParent()
            self.tabBarController = nil
            self.resetWebViewInset()
            call.resolve(["hidden": true])
        }
    }

    // MARK: - setActiveTab (called from JS when page changes)
    @objc func setActiveTab(_ call: CAPPluginCall) {
        guard let tabId = call.getString("tab") else {
            call.reject("Missing 'tab' parameter")
            return
        }
        DispatchQueue.main.async { [weak self] in
            self?.tabBarController?.setActiveTab(id: tabId)
            call.resolve(["ok": true])
        }
    }

    // MARK: - Private helpers

    private func adjustWebViewInset(rootView: UIView) {
        guard let webView = bridge?.webView else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { [weak self] in
            guard let tabBarView = self?.tabBarController?.view else { return }
            let height = tabBarView.frame.height
            guard height > 0 else { return }
            let inset = UIEdgeInsets(top: 0, left: 0, bottom: height, right: 0)
            webView.scrollView.contentInset = inset
            webView.scrollView.verticalScrollIndicatorInsets = inset
        }
    }

    private func resetWebViewInset() {
        guard let webView = bridge?.webView else { return }
        webView.scrollView.contentInset = .zero
        webView.scrollView.verticalScrollIndicatorInsets = .zero
    }
}

// MARK: - NativeTabBarController

/// A UIViewController that hosts a native UITabBar with Liquid Glass styling.
/// On iOS 26+ the system automatically renders the selection indicator capsule
/// and animates it with spring physics as you tap between tabs.
class NativeTabBarController: UIViewController, UITabBarDelegate {

    var onTabSelected: ((String, String) -> Void)?

    private let tabBar = UITabBar()
    private var activeTabId: String = "home"

    /// Tabs determined by user role — set at init time.
    private var tabs: [TabItem] = []

    // MARK: - Init

    init(role: String = "guest") {
        super.init(nibName: nil, bundle: nil)
        self.tabs = tabsForRole(role)
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        self.tabs = tabsForRole("guest")
    }

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        setupTabBar()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Keep controller view height = tab bar height (safe area included)
        let tabBarHeight = tabBar.frame.height
        view.frame.size.height = tabBarHeight
    }

    // MARK: - Setup

    private func setupTabBar() {
        tabBar.delegate = self
        tabBar.translatesAutoresizingMaskIntoConstraints = false

        // ── Liquid Glass appearance (iOS 26+) ──────────────────────────────────
        if #available(iOS 26.0, *) {
            // UITabBar on iOS 26 automatically uses Liquid Glass material.
            // We just set appearance tint colors; the capsule + animation are native.
            let appearance = UITabBarAppearance()
            appearance.configureWithDefaultBackground()   // Liquid Glass base

            // Normal (inactive) state
            let normalItem = appearance.stackedLayoutAppearance.normal
            normalItem.iconColor = UIColor.secondaryLabel
            normalItem.titleTextAttributes = [
                .foregroundColor: UIColor.secondaryLabel,
                .font: UIFont.systemFont(ofSize: 10, weight: .medium)
            ]

            // Selected (active) state — emerald green for NewKet brand
            let selectedColor = UIColor(red: 0.04, green: 0.29, blue: 0.18, alpha: 1.0) // #0A4A2E
            let selectedItem = appearance.stackedLayoutAppearance.selected
            selectedItem.iconColor = selectedColor
            selectedItem.titleTextAttributes = [
                .foregroundColor: selectedColor,
                .font: UIFont.systemFont(ofSize: 10, weight: .bold)
            ]

            tabBar.standardAppearance = appearance
            tabBar.scrollEdgeAppearance = appearance
            tabBar.tintColor = selectedColor
        } else {
            // Fallback for iOS < 26 (plain style)
            tabBar.tintColor = UIColor(red: 0.04, green: 0.29, blue: 0.18, alpha: 1.0)
            tabBar.unselectedItemTintColor = .secondaryLabel
        }

        // ── Build UITabBarItems from tab definitions ───────────────────────────
        let symbolConfig = UIImage.SymbolConfiguration(pointSize: 20, weight: .regular)
        let symbolConfigFill = UIImage.SymbolConfiguration(pointSize: 20, weight: .regular)

        let tabBarItems = tabs.enumerated().map { (index, tab) -> UITabBarItem in
            let normalImage  = UIImage(systemName: tab.sfSymbol,     withConfiguration: symbolConfig)?
                .withRenderingMode(.alwaysTemplate)
            let selectedImage = UIImage(systemName: tab.sfSymbolFill, withConfiguration: symbolConfigFill)?
                .withRenderingMode(.alwaysTemplate)

            let item = UITabBarItem(title: tab.title, image: normalImage, tag: index)
            item.selectedImage = selectedImage
            return item
        }

        tabBar.setItems(tabBarItems, animated: false)

        view.addSubview(tabBar)
        NSLayoutConstraint.activate([
            tabBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tabBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            tabBar.topAnchor.constraint(equalTo: view.topAnchor)
        ])

        // Set initial selection
        selectTabBarItem(id: activeTabId)
    }

    // MARK: - Public API

    func setActiveTab(id: String) {
        activeTabId = id
        selectTabBarItem(id: id)
    }

    // MARK: - UITabBarDelegate

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard let index = tabBar.items?.firstIndex(of: item),
              index < tabs.count else { return }
        let tab = tabs[index]
        activeTabId = tab.id
        onTabSelected?(tab.id, tab.url)
    }

    // MARK: - Private helpers

    private func selectTabBarItem(id: String) {
        guard let index = tabs.firstIndex(where: { $0.id == id }),
              let items = tabBar.items, index < items.count else { return }
        tabBar.selectedItem = items[index]
    }
}
