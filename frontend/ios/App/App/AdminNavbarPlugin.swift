import UIKit
import Capacitor

// MARK: - Plugin Declaration

@objc(AdminNavbarPlugin)
public class AdminNavbarPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "AdminNavbarPlugin"
    public let jsName = "AdminNavbar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isNativeAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise)
    ]

    private var navbarView: UIView?

    // MARK: - isNativeAvailable
    /// Called from JS to know if iOS 26+ Liquid Glass is available on this device.
    @objc func isNativeAvailable(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            call.resolve(["available": true])
        } else {
            call.resolve(["available": false])
        }
    }

    // MARK: - show
    /// Injects the native Liquid Glass navbar above the WebView (iOS 26+).
    /// On iOS < 26, immediately resolves with shown: false so JS falls back to HTML navbar.
    @objc func show(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else {
            call.resolve(["shown": false])
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self,
                  let viewController = self.bridge?.viewController,
                  let rootView = viewController.view else {
                call.reject("AdminNavbarPlugin: rootView not found")
                return
            }

            // Remove any existing instance to avoid duplicates
            self.navbarView?.removeFromSuperview()
            self.navbarView = nil

            let navbar = AdminNavbarLiquidGlassView()
            navbar.translatesAutoresizingMaskIntoConstraints = false

            // Wire button actions → Capacitor events → JS listeners
            navbar.onMenuTap = { [weak self] in
                self?.notifyListeners("menuTap", data: [:])
            }
            navbar.onLogoutTap = { [weak self] in
                self?.notifyListeners("logoutTap", data: [:])
            }
            navbar.onShopTap = { [weak self] in
                self?.notifyListeners("shopTap", data: [:])
            }

            rootView.addSubview(navbar)

            NSLayoutConstraint.activate([
                navbar.topAnchor.constraint(equalTo: rootView.topAnchor),
                navbar.leadingAnchor.constraint(equalTo: rootView.leadingAnchor),
                navbar.trailingAnchor.constraint(equalTo: rootView.trailingAnchor)
            ])

            self.navbarView = navbar

            // Adjust WebView scroll inset so page content isn't hidden under the native navbar
            self.pushWebViewContentDown(rootView: rootView)

            call.resolve(["shown": true])
        }
    }

    // MARK: - hide
    /// Removes the native navbar and restores the WebView scroll offset.
    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            self.navbarView?.removeFromSuperview()
            self.navbarView = nil
            self.resetWebViewContentInset()

            call.resolve(["hidden": true])
        }
    }

    // MARK: - Private helpers

    private func pushWebViewContentDown(rootView: UIView) {
        guard let webView = bridge?.webView else { return }
        // Wait one layout pass so the navbar frame is resolved
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
            guard let navbarView = self?.navbarView else { return }
            let height = navbarView.frame.height
            guard height > 0 else { return }
            webView.scrollView.contentInset.top = height
            webView.scrollView.verticalScrollIndicatorInsets.top = height
        }
    }

    private func resetWebViewContentInset() {
        guard let webView = bridge?.webView else { return }
        webView.scrollView.contentInset.top = 0
        webView.scrollView.verticalScrollIndicatorInsets.top = 0
    }
}

// MARK: - AdminNavbarLiquidGlassView (iOS 26+)

/// A floating native navbar using Apple's UIGlassEffect (Liquid Glass).
/// Available only on iOS 26+. Falls back to HTML navbar on older versions via plugin guard.
@available(iOS 26.0, *)
class AdminNavbarLiquidGlassView: UIView {

    // Callbacks wired by the plugin
    var onMenuTap:   (() -> Void)?
    var onLogoutTap: (() -> Void)?
    var onShopTap:   (() -> Void)?

    // Subviews
    private let glassEffectView: UIVisualEffectView
    private let menuButton:      UIButton
    private let logoLabel:       UILabel
    private let shopButton:      UIButton
    private let logoutButton:    UIButton
    private let contentStack:    UIStackView

    private var heightConstraint: NSLayoutConstraint?

    // MARK: Init

    override init(frame: CGRect) {
        // ── Liquid Glass background ──────────────────────────────────────────
        let glass = UIGlassEffect()
        glassEffectView = UIVisualEffectView(effect: glass)

        // ── Hamburger menu ───────────────────────────────────────────────────
        menuButton = UIButton(type: .system)

        // ── Logo ─────────────────────────────────────────────────────────────
        logoLabel = UILabel()

        // ── Shop link ────────────────────────────────────────────────────────
        shopButton = UIButton(type: .system)

        // ── Logout ───────────────────────────────────────────────────────────
        logoutButton = UIButton(type: .system)

        // ── Horizontal stack for left / center / right groups ────────────────
        contentStack = UIStackView()

        super.init(frame: frame)
        setupUI()
    }

    required init?(coder: NSCoder) {
        let glass = UIGlassEffect()
        glassEffectView = UIVisualEffectView(effect: glass)
        menuButton      = UIButton(type: .system)
        logoLabel       = UILabel()
        shopButton      = UIButton(type: .system)
        logoutButton    = UIButton(type: .system)
        contentStack    = UIStackView()
        super.init(coder: coder)
        setupUI()
    }

    // MARK: Layout

    override func layoutSubviews() {
        super.layoutSubviews()
        updateHeightForSafeArea()
    }

    override func safeAreaInsetsDidChange() {
        super.safeAreaInsetsDidChange()
        updateHeightForSafeArea()
    }

    private func updateHeightForSafeArea() {
        let safeTop = safeAreaInsets.top
        let total   = safeTop + 56 // 56pt content area
        heightConstraint?.constant = total
        // Shift content stack below status bar
        contentStack.layoutMargins = UIEdgeInsets(top: safeTop, left: 16, bottom: 0, right: 16)
    }

    // MARK: Setup

    private func setupUI() {
        // ── Self ─────────────────────────────────────────────────────────────
        backgroundColor = .clear

        // ── Glass view fills self ────────────────────────────────────────────
        glassEffectView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(glassEffectView)
        NSLayoutConstraint.activate([
            glassEffectView.topAnchor.constraint(equalTo: topAnchor),
            glassEffectView.leadingAnchor.constraint(equalTo: leadingAnchor),
            glassEffectView.trailingAnchor.constraint(equalTo: trailingAnchor),
            glassEffectView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])

        // ── Self height constraint (updated in layoutSubviews) ───────────────
        let h = heightAnchor.constraint(equalToConstant: 56)
        h.isActive = true
        heightConstraint = h

        // ── Menu button (hamburger) ──────────────────────────────────────────
        configureMenuButton()

        // ── Logo ─────────────────────────────────────────────────────────────
        configureLogoLabel()

        // ── Shop + Logout buttons ────────────────────────────────────────────
        configureShopButton()
        configureLogoutButton()

        // ── Layout: Left | Center | Right ────────────────────────────────────
        let leftGroup  = makeGroup(views: [menuButton])
        let centerGroup = logoLabel
        let rightGroup = makeGroup(views: [shopButton, logoutButton])

        contentStack.axis         = .horizontal
        contentStack.alignment    = .center
        contentStack.distribution = .equalSpacing
        contentStack.isLayoutMarginsRelativeArrangement = true
        contentStack.layoutMargins = UIEdgeInsets(top: 0, left: 16, bottom: 0, right: 16)
        contentStack.translatesAutoresizingMaskIntoConstraints = false

        contentStack.addArrangedSubview(leftGroup)
        contentStack.addArrangedSubview(centerGroup)
        contentStack.addArrangedSubview(rightGroup)

        glassEffectView.contentView.addSubview(contentStack)
        NSLayoutConstraint.activate([
            contentStack.leadingAnchor.constraint(equalTo: glassEffectView.contentView.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: glassEffectView.contentView.trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: glassEffectView.contentView.bottomAnchor),
            contentStack.heightAnchor.constraint(equalToConstant: 56)
        ])

        // ── Bottom separator ──────────────────────────────────────────────────
        let separator = UIView()
        separator.backgroundColor = UIColor.separator.withAlphaComponent(0.2)
        separator.translatesAutoresizingMaskIntoConstraints = false
        addSubview(separator)
        NSLayoutConstraint.activate([
            separator.heightAnchor.constraint(equalToConstant: 0.5),
            separator.leadingAnchor.constraint(equalTo: leadingAnchor),
            separator.trailingAnchor.constraint(equalTo: trailingAnchor),
            separator.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    // MARK: Button helpers

    private func configureMenuButton() {
        let config = UIImage.SymbolConfiguration(pointSize: 20, weight: .medium)
        let image  = UIImage(systemName: "line.3.horizontal", withConfiguration: config)
        menuButton.setImage(image, for: .normal)
        menuButton.tintColor       = .label
        menuButton.frame.size      = CGSize(width: 44, height: 44)
        menuButton.addTarget(self, action: #selector(handleMenuTap), for: .touchUpInside)

        // Liquid Glass tint on the button itself (iOS 26+ button glass style)
        var btnConfig = UIButton.Configuration.filled()
        btnConfig.baseBackgroundColor = .clear
        btnConfig.image = image
        btnConfig.imagePadding = 0
        menuButton.configuration = btnConfig
        menuButton.tintColor = .label
    }

    private func configureLogoLabel() {
        logoLabel.text          = "NewKet"
        logoLabel.font          = UIFont.systemFont(ofSize: 17, weight: .black)
        logoLabel.textColor     = .label
        logoLabel.textAlignment = .center
    }

    private func configureShopButton() {
        var config           = UIButton.Configuration.plain()
        config.title         = "Boutique"
        config.image         = UIImage(systemName: "globe",
                                       withConfiguration: UIImage.SymbolConfiguration(pointSize: 13, weight: .semibold))
        config.imagePadding  = 4
        config.baseForegroundColor = .secondaryLabel
        config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attrs in
            var a = attrs
            a.font = UIFont.systemFont(ofSize: 11, weight: .black)
            return a
        }
        shopButton.configuration = config
        shopButton.addTarget(self, action: #selector(handleShopTap), for: .touchUpInside)
    }

    private func configureLogoutButton() {
        var config           = UIButton.Configuration.filled()
        config.title         = "Quitter"
        config.image         = UIImage(systemName: "rectangle.portrait.and.arrow.right",
                                       withConfiguration: UIImage.SymbolConfiguration(pointSize: 13, weight: .semibold))
        config.imagePadding  = 4
        let trueRed          = UIColor(red: 255/255, green: 10/255, blue: 10/255, alpha: 1.0)
        config.baseBackgroundColor = trueRed.withAlphaComponent(0.14)
        config.baseForegroundColor = trueRed
        config.cornerStyle   = .capsule
        config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attrs in
            var a = attrs
            a.font = UIFont.systemFont(ofSize: 11, weight: .black)
            return a
        }
        logoutButton.configuration = config
        logoutButton.addTarget(self, action: #selector(handleLogoutTap), for: .touchUpInside)
    }

    private func makeGroup(views: [UIView]) -> UIStackView {
        let stack       = UIStackView(arrangedSubviews: views)
        stack.axis      = .horizontal
        stack.alignment = .center
        stack.spacing   = 8
        return stack
    }

    // MARK: Actions

    @objc private func handleMenuTap()   { onMenuTap?()   }
    @objc private func handleShopTap()   { onShopTap?()   }
    @objc private func handleLogoutTap() { onLogoutTap?() }
}
