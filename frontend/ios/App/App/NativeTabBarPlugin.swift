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
    /// Default consumer tabs
    public static let defaultTabs: [TabItem] = [
        TabItem(id: "home",    label: "Accueil",   systemImage: "house",          path: "/"),
        TabItem(id: "catalog", label: "Catalogue", systemImage: "storefront",     path: "/catalog"),
        TabItem(id: "shops",   label: "Boutiques", systemImage: "bag",            path: "/shops"),
        TabItem(id: "cart",    label: "Panier",    systemImage: "cart",           path: "##cart"),
        TabItem(id: "account", label: "Compte",    systemImage: "person",         path: "/customer-dashboard"),
    ]

    /// Seller tabs (replaces Boutiques with Vendre)
    public static let sellerTabs: [TabItem] = [
        TabItem(id: "home",    label: "Accueil",   systemImage: "house",          path: "/"),
        TabItem(id: "catalog", label: "Catalogue", systemImage: "storefront",     path: "/catalog"),
        TabItem(id: "sell",    label: "Vendre",    systemImage: "plus.circle",    path: "/publish"),
        TabItem(id: "cart",    label: "Panier",    systemImage: "cart",           path: "##cart"),
        TabItem(id: "account", label: "Compte",    systemImage: "person",         path: "/vendor-dashboard"),
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

    weak var plugin: NativeTabBarPlugin?
    weak var bridgeVC: NewKetBridgeViewController?

    public func onTabSelected(id: String) {
        guard let tab = tabs.first(where: { $0.id == id }) else { return }

        if tab.path == "##cart" {
            // Special trigger: toggle cart drawer without changing tab selection
            bridgeVC?.bridge?.webView?.evaluateJavaScript(
                "window.CartManager?.toggleCartUI?.();",
                completionHandler: nil
            )
            return
        }

        selectedTabId = id
        plugin?.notifyTabChanged(tabId: id)

        let targetPath = tab.path
        let js = """
        (function() {
            var target = '\(targetPath)';
            if (window.location.pathname !== target) {
                window.history.pushState({}, '', target);
                window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
        })();
        """
        bridgeVC?.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)
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

/// The root SwiftUI view.
/// Uses the modern `Tab("Title", systemImage: "...", value: ...)` syntax (iOS 18+ / iOS 26)
/// as seen in the official Liquid Glass SwiftUI demonstration.
public struct NativeTabRootView: View {

    @StateObject private var coordinator = NativeTabCoordinator()
    public let bridgeVC: NewKetBridgeViewController

    public init(bridgeVC: NewKetBridgeViewController) {
        self.bridgeVC = bridgeVC
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
                }
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
