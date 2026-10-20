import UIKit
import Capacitor

// MARK: - Plugin Declaration

@objc(NativeHeaderButtonsPlugin)
public class NativeHeaderButtonsPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "NativeHeaderButtonsPlugin"
    public let jsName = "NativeHeaderButtons"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
    ]

    private var overlayView: UIView?

    // MARK: - show

    /// Injects two native glass buttons above the WebView.
    /// Options:
    ///   showLeft  (Bool, default true)  — left burger button
    ///   showRight (Bool, default true)  — right action button
    ///   rightIcon (String)              — SF Symbol name for right button
    ///                                    "magnifyingglass" | "rectangle.portrait.and.arrow.right"
    @objc func show(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else {
            call.resolve(["shown": false])
            return
        }

        let showLeft  = call.getBool("showLeft")  ?? true
        let showRight = call.getBool("showRight") ?? true
        let rightIcon = call.getString("rightIcon") ?? "magnifyingglass"

        DispatchQueue.main.async { [weak self] in
            guard let self,
                  let vc   = self.bridge?.viewController,
                  let root = vc.view else {
                call.reject("NativeHeaderButtonsPlugin: rootView not found")
                return
            }

            // Remove any previous instance
            self.overlayView?.removeFromSuperview()
            self.overlayView = nil

            if !showLeft && !showRight {
                call.resolve(["shown": false])
                return
            }

            let overlay = NativeHeaderButtonsView(showLeft: showLeft, showRight: showRight, rightIcon: rightIcon)
            overlay.translatesAutoresizingMaskIntoConstraints = false

            overlay.onLeftTap = { [weak self] in
                self?.notifyListeners("burgerTap", data: [:])
            }
            overlay.onRightTap = { [weak self] in
                self?.notifyListeners("rightTap", data: [:])
            }

            root.addSubview(overlay)

            NSLayoutConstraint.activate([
                overlay.topAnchor.constraint(equalTo: root.topAnchor),
                overlay.leadingAnchor.constraint(equalTo: root.leadingAnchor),
                overlay.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            ])

            self.overlayView = overlay
            call.resolve(["shown": true])
        }
    }

    // MARK: - hide

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.overlayView?.removeFromSuperview()
            self?.overlayView = nil
            call.resolve(["hidden": true])
        }
    }

    // MARK: - update

    /// Update button visibility / icons without rebuilding the whole overlay.
    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else {
            call.resolve()
            return
        }
        let showLeft  = call.getBool("showLeft")
        let showRight = call.getBool("showRight")
        let rightIcon = call.getString("rightIcon")

        DispatchQueue.main.async { [weak self] in
            if let overlay = self?.overlayView as? NativeHeaderButtonsView {
                overlay.update(showLeft: showLeft, showRight: showRight, rightIcon: rightIcon)
            }
            call.resolve()
        }
    }
}

// MARK: - NativeHeaderButtonsView (iOS 26+)

/// Two floating buttons pinned to the safe-area insets of the top edge,
/// styled identically to the iOS system back button (compact glass capsule).
@available(iOS 26.0, *)
class NativeHeaderButtonsView: UIView {

    // Callbacks
    var onLeftTap:  (() -> Void)?
    var onRightTap: (() -> Void)?

    // Subviews
    private let leftButton:  UIButton
    private let rightButton: UIButton

    private var rightIconName: String
    private var heightConstraint: NSLayoutConstraint?

    // MARK: Init

    init(showLeft: Bool, showRight: Bool, rightIcon: String) {
        self.rightIconName = rightIcon
        leftButton  = UIButton(type: .system)
        rightButton = UIButton(type: .system)
        super.init(frame: .zero)
        setupUI(showLeft: showLeft, showRight: showRight)
    }

    required init?(coder: NSCoder) {
        self.rightIconName = "magnifyingglass"
        leftButton  = UIButton(type: .system)
        rightButton = UIButton(type: .system)
        super.init(coder: coder)
        setupUI(showLeft: true, showRight: true)
    }

    // MARK: Layout

    override func layoutSubviews() {
        super.layoutSubviews()
        updateHeight()
    }

    override func safeAreaInsetsDidChange() {
        super.safeAreaInsetsDidChange()
        updateHeight()
    }

    private func updateHeight() {
        let safeTop = safeAreaInsets.top
        // Height = status bar + button area (44pt) + small padding
        heightConstraint?.constant = safeTop + 54
    }

    // MARK: Setup

    private func setupUI(showLeft: Bool, showRight: Bool) {
        backgroundColor = .clear
        // This view itself is transparent — only the individual buttons have glass

        let h = heightAnchor.constraint(equalToConstant: 54)
        h.isActive = true
        heightConstraint = h

        // ── Left button (Burger) ──────────────────────────────────────────────
        configureButton(leftButton, sfSymbol: "line.3.horizontal")
        leftButton.addTarget(self, action: #selector(handleLeftTap), for: .touchUpInside)
        leftButton.isHidden = !showLeft
        leftButton.translatesAutoresizingMaskIntoConstraints = false
        addSubview(leftButton)

        // ── Right button (Search / Logout) ────────────────────────────────────
        configureButton(rightButton, sfSymbol: rightIconName)
        rightButton.addTarget(self, action: #selector(handleRightTap), for: .touchUpInside)
        rightButton.isHidden = !showRight
        rightButton.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rightButton)

        // ── Constraints: pin buttons to bottom of self (i.e. below status bar) ─
        // We place them at a fixed offset from the bottom of this view so they
        // appear just below the status bar regardless of device (safe-area driven).
        NSLayoutConstraint.activate([
            // Left button — leading edge
            leftButton.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            leftButton.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
            leftButton.widthAnchor.constraint(equalToConstant: 34),
            leftButton.heightAnchor.constraint(equalToConstant: 34),

            // Right button — trailing edge
            rightButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            rightButton.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
            rightButton.widthAnchor.constraint(equalToConstant: 34),
            rightButton.heightAnchor.constraint(equalToConstant: 34),
        ])
    }

    // MARK: Button style — identical to iOS back button (glass capsule)

    private func configureButton(_ button: UIButton, sfSymbol: String) {
        // SF Symbol config — medium weight, 17pt
        let symbolConfig = UIImage.SymbolConfiguration(pointSize: 17, weight: .medium)
        let image = UIImage(systemName: sfSymbol, withConfiguration: symbolConfig)

        // UIButton.Configuration for compact filled glass style
        var config = UIButton.Configuration.filled()
        config.image             = image
        config.imagePadding      = 0
        config.contentInsets     = NSDirectionalEdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8)
        config.cornerStyle       = .fixed           // square corners, like the back button capsule

        // Dark frosted glass background — matches iOS system back button
        config.baseBackgroundColor = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor.white.withAlphaComponent(0.15)
                : UIColor.black.withAlphaComponent(0.10)
        }
        config.baseForegroundColor = .white         // white icon on dark glass

        button.configuration        = config
        button.tintColor            = .white

        // Apply real UIGlassEffect on top of the button background
        let glass     = UIGlassEffect()
        let glassView = UIVisualEffectView(effect: glass)
        glassView.isUserInteractionEnabled = false
        glassView.layer.cornerRadius       = 10
        glassView.clipsToBounds            = true
        glassView.translatesAutoresizingMaskIntoConstraints = false

        button.insertSubview(glassView, at: 0)
        NSLayoutConstraint.activate([
            glassView.topAnchor.constraint(equalTo: button.topAnchor),
            glassView.leadingAnchor.constraint(equalTo: button.leadingAnchor),
            glassView.trailingAnchor.constraint(equalTo: button.trailingAnchor),
            glassView.bottomAnchor.constraint(equalTo: button.bottomAnchor),
        ])

        // Shadow for depth (matches system button)
        button.layer.shadowColor   = UIColor.black.cgColor
        button.layer.shadowOpacity = 0.18
        button.layer.shadowRadius  = 4
        button.layer.shadowOffset  = CGSize(width: 0, height: 2)
    }

    // MARK: Update

    func update(showLeft: Bool?, showRight: Bool?, rightIcon: String?) {
        if let showLeft  { leftButton.isHidden  = !showLeft  }
        if let showRight { rightButton.isHidden = !showRight }
        if let icon = rightIcon, icon != rightIconName {
            rightIconName = icon
            rightButton.subviews
                .compactMap { $0 as? UIVisualEffectView }
                .forEach { $0.removeFromSuperview() }
            configureButton(rightButton, sfSymbol: icon)
        }
    }

    // MARK: Actions

    @objc private func handleLeftTap()  { onLeftTap?()  }
    @objc private func handleRightTap() { onRightTap?() }
}
