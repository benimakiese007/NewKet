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
        TabItem(id: "catalog", label: "Catalogue", systemImage: "storefront",     path: "/src/pages/catalog.html"),
        TabItem(id: "shops",   label: "Boutiques", systemImage: "bag",            path: "/src/pages/shops.html"),
        TabItem(id: "cart",    label: "Panier",    systemImage: "cart",           path: "##cart"),
        TabItem(id: "account", label: "Compte",    systemImage: "person",         path: "/src/pages/customer-dashboard.html"),
        TabItem(id: "menu",    label: "Menu",      systemImage: "line.3.horizontal", path: "##menu"),
    ]

    /// Seller tabs (replaces Boutiques with Vendre)
    public static let sellerTabs: [TabItem] = [
        TabItem(id: "home",    label: "Accueil",   systemImage: "house",          path: "/index.html"),
        TabItem(id: "catalog", label: "Catalogue", systemImage: "storefront",     path: "/src/pages/catalog.html"),
        TabItem(id: "sell",    label: "Vendre",    systemImage: "plus.circle",    path: "/src/pages/publish.html"),
        TabItem(id: "cart",    label: "Panier",    systemImage: "cart",           path: "##cart"),
        TabItem(id: "account", label: "Compte",    systemImage: "person",         path: "/src/pages/vendor-dashboard.html"),
        TabItem(id: "menu",    label: "Menu",      systemImage: "line.3.horizontal", path: "##menu"),
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
    ]

    public weak var coordinator: NativeTabCoordinator?

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

    public weak var plugin: NativeTabBarPlugin?
    public weak var bridgeVC: NewKetBridgeViewController?

    public init(bridgeVC: NewKetBridgeViewController? = nil) {
        self.bridgeVC = bridgeVC
    }

    public func onTabSelected(id: String) {
        if id == "search" {
            let searchJs = """
            (function() {
                if (window.location.pathname.includes('catalog.html')) {
                    const searchInput = document.querySelector('.search-input') || document.querySelector('input[type="search"]');
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.scrollIntoView({ behavior: 'smooth' });
                    }
                } else {
                    window.location.href = '/src/pages/catalog.html?focus=search';
                }
            })();
            """
            bridgeVC?.bridge?.webView?.evaluateJavaScript(searchJs, completionHandler: nil)
            return
        }

        guard let tab = tabs.first(where: { $0.id == id }) else { return }

        if tab.path == "##menu" {
            let menuJs = """
            (function() {
                if (typeof window.SidebarManager !== 'undefined' && typeof window.SidebarManager.toggle === 'function') {
                    window.SidebarManager.toggle();
                } else if (document.getElementById('mobileMenuBtn')) {
                    document.getElementById('mobileMenuBtn').click();
                } else if (document.getElementById('customerMobileBtn')) {
                    document.getElementById('customerMobileBtn').click();
                } else if (document.getElementById('vendorMobileBtn')) {
                    document.getElementById('vendorMobileBtn').click();
                }
            })();
            """
            bridgeVC?.bridge?.webView?.evaluateJavaScript(menuJs, completionHandler: nil)
            return
        }

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
        guard tabs.contains(where: { $0.id == id }) else { return }
        selectedTabId = id
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
}

// MARK: - Full Native SwiftUI TabView (Liquid Glass on iOS 26)

public struct NativeTabRootView: View {

    @ObservedObject public var coordinator: NativeTabCoordinator
    public let bridgeVC: NewKetBridgeViewController

    public init(bridgeVC: NewKetBridgeViewController, coordinator: NativeTabCoordinator) {
        self.bridgeVC = bridgeVC
        self.coordinator = coordinator
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
                        Tab(tab.label, systemImage: tab.systemImage, value: tab.id) {
                            CapacitorWebViewRepresentable(bridgeVC: bridgeVC)
                                .ignoresSafeArea()
                        }
                        .badge(coordinator.badges[tab.id] ?? 0)
                    }

                    Tab(value: "search", role: .search) {
                        CapacitorWebViewRepresentable(bridgeVC: bridgeVC)
                            .ignoresSafeArea()
                    }
                }
                .tint(Color(red: 10.0 / 255.0, green: 132.0 / 255.0, blue: 255.0 / 255.0))
            } else {
                // Fallback for earlier iOS versions
                TabView(selection: Binding(
                    get: { coordinator.selectedTabId },
                    set: { newId in coordinator.onTabSelected(id: newId) }
                )) {
                    ForEach(coordinator.tabs) { tab in
                        CapacitorWebViewRepresentable(bridgeVC: bridgeVC)
                            .ignoresSafeArea()
                            .tabItem {
                                Label(tab.label, systemImage: tab.systemImage)
                            }
                            .tag(tab.id)
                            .badge(coordinator.badges[tab.id] ?? 0)
                    }
                }
                .tint(Color(red: 10.0 / 255.0, green: 132.0 / 255.0, blue: 255.0 / 255.0))
            }
        }
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
