import UIKit
import Capacitor

// MARK: - Plugin Declaration

@objc(NativeHeaderButtonsPlugin)
public class NativeHeaderButtonsPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "NativeHeaderButtonsPlugin"
    public let jsName = "NativeHeaderButtons"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show",   returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide",   returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
    ]

    private var overlayView: UIView?

    // MARK: - show

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

// MARK: - GlassCircleButton (iOS 26+ Liquid Glass Sphere)

/// A 38x38pt perfect round circular Liquid Glass sphere conforming to Apple HIG:
/// - Circular UIVisualEffectView container with UIGlassEffect (in: .circle)
/// - 44x44pt touch hit target for 100% accessible touch responsiveness
/// - Inner 100% transparent (.plain) button with 16pt semibold SF Symbol
@available(iOS 26.0, *)
class GlassCircleButton: UIView {

    let glassEffectView: UIVisualEffectView
    let button: UIButton

    init(sfSymbol: String) {
        let glass = UIGlassEffect()
        glassEffectView = UIVisualEffectView(effect: glass)
        button = UIButton(type: .system)

        super.init(frame: .zero)

        // Outer shadow for 3D depth elevation (matches system circular back button)
        layer.shadowColor   = UIColor.black.cgColor
        layer.shadowOpacity = 0.22
        layer.shadowRadius  = 5
        layer.shadowOffset  = CGSize(width: 0, height: 2)

        // Perfect circular glass sphere: cornerRadius = width / 2 (38 / 2 = 19)
        glassEffectView.layer.cornerRadius = 19
        glassEffectView.layer.cornerCurve  = .circular
        glassEffectView.clipsToBounds      = true
        glassEffectView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(glassEffectView)

        NSLayoutConstraint.activate([
            glassEffectView.topAnchor.constraint(equalTo: topAnchor),
            glassEffectView.leadingAnchor.constraint(equalTo: leadingAnchor),
            glassEffectView.trailingAnchor.constraint(equalTo: trailingAnchor),
            glassEffectView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        // Subtle dark translucent tint inside contentView for crisp contrast
        let tintLayer = UIView()
        tintLayer.backgroundColor = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor.white.withAlphaComponent(0.12)
                : UIColor.black.withAlphaComponent(0.18)
        }
        tintLayer.isUserInteractionEnabled = false
        tintLayer.translatesAutoresizingMaskIntoConstraints = false
        glassEffectView.contentView.addSubview(tintLayer)

        NSLayoutConstraint.activate([
            tintLayer.topAnchor.constraint(equalTo: glassEffectView.contentView.topAnchor),
            tintLayer.leadingAnchor.constraint(equalTo: glassEffectView.contentView.leadingAnchor),
            tintLayer.trailingAnchor.constraint(equalTo: glassEffectView.contentView.trailingAnchor),
            tintLayer.bottomAnchor.constraint(equalTo: glassEffectView.contentView.bottomAnchor),
        ])

        // Inner plain button
        updateSymbol(sfSymbol)
        button.translatesAutoresizingMaskIntoConstraints = false
        glassEffectView.contentView.addSubview(button)

        NSLayoutConstraint.activate([
            button.topAnchor.constraint(equalTo: glassEffectView.contentView.topAnchor),
            button.leadingAnchor.constraint(equalTo: glassEffectView.contentView.leadingAnchor),
            button.trailingAnchor.constraint(equalTo: glassEffectView.contentView.trailingAnchor),
            button.bottomAnchor.constraint(equalTo: glassEffectView.contentView.bottomAnchor),
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    /// Expands touch target to 44x44pt as recommended by Apple HIG
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        let dx = max(0, (44 - bounds.width) / 2)
        let dy = max(0, (44 - bounds.height) / 2)
        let expanded = bounds.insetBy(dx: -dx, dy: -dy)
        return expanded.contains(point)
    }

    func updateSymbol(_ sfSymbol: String) {
        let symbolConfig = UIImage.SymbolConfiguration(pointSize: 16, weight: .semibold)
        let image = UIImage(systemName: sfSymbol, withConfiguration: symbolConfig)

        var config = UIButton.Configuration.plain()
        config.image = image
        config.baseForegroundColor = .white
        config.contentInsets = .zero
        button.configuration = config
        button.tintColor = .white
    }
}

// MARK: - NativeHeaderButtonsView (iOS 26+)

@available(iOS 26.0, *)
class NativeHeaderButtonsView: UIView {

    var onLeftTap:  (() -> Void)?
    var onRightTap: (() -> Void)?

    private let leftCircle:  GlassCircleButton
    private let rightCircle: GlassCircleButton

    private var rightIconName: String
    private var heightConstraint: NSLayoutConstraint?

    init(showLeft: Bool, showRight: Bool, rightIcon: String) {
        self.rightIconName = rightIcon
        self.leftCircle    = GlassCircleButton(sfSymbol: "line.3.horizontal")
        self.rightCircle   = GlassCircleButton(sfSymbol: rightIcon)
        super.init(frame: .zero)
        setupUI(showLeft: showLeft, showRight: showRight)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // Pass non-button taps straight through to the WebView underneath
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hitView = super.hitTest(point, with: event)
        if hitView === self {
            return nil
        }
        return hitView
    }

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
        heightConstraint?.constant = safeTop + 54
    }

    private func setupUI(showLeft: Bool, showRight: Bool) {
        backgroundColor = .clear

        let h = heightAnchor.constraint(equalToConstant: 54)
        h.isActive = true
        heightConstraint = h

        // Wire taps
        leftCircle.button.addTarget(self, action: #selector(handleLeftTap), for: .touchUpInside)
        leftCircle.isHidden = !showLeft
        leftCircle.translatesAutoresizingMaskIntoConstraints = false
        addSubview(leftCircle)

        rightCircle.button.addTarget(self, action: #selector(handleRightTap), for: .touchUpInside)
        rightCircle.isHidden = !showRight
        rightCircle.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rightCircle)

        NSLayoutConstraint.activate([
            // Left circle: pinned to leading edge, 38x38pt perfect sphere
            leftCircle.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            leftCircle.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -6),
            leftCircle.widthAnchor.constraint(equalToConstant: 38),
            leftCircle.heightAnchor.constraint(equalToConstant: 38),

            // Right circle: pinned to trailing edge, 38x38pt perfect sphere
            rightCircle.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            rightCircle.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -6),
            rightCircle.widthAnchor.constraint(equalToConstant: 38),
            rightCircle.heightAnchor.constraint(equalToConstant: 38),
        ])
    }

    func update(showLeft: Bool?, showRight: Bool?, rightIcon: String?) {
        if let showLeft  { leftCircle.isHidden  = !showLeft  }
        if let showRight { rightCircle.isHidden = !showRight }
        if let icon = rightIcon, icon != rightIconName {
            rightIconName = icon
            rightCircle.updateSymbol(icon)
        }
    }

    @objc private func handleLeftTap()  { onLeftTap?()  }
    @objc private func handleRightTap() { onRightTap?() }
}
