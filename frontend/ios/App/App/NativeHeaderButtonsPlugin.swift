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

// MARK: - GlassCapsuleButton (iOS 26+)

/// A 34x34pt compact Liquid Glass capsule identical to Apple's system back button:
/// Outer UIVisualEffectView container with UIGlassEffect and rounded corners,
/// with a 100% transparent (.plain) UIButton inside its contentView.
@available(iOS 26.0, *)
class GlassCapsuleButton: UIView {

    let glassEffectView: UIVisualEffectView
    let button: UIButton

    init(sfSymbol: String) {
        let glass = UIGlassEffect()
        glassEffectView = UIVisualEffectView(effect: glass)
        button = UIButton(type: .system)

        super.init(frame: .zero)

        // Outer shadow for 3D depth elevation (matches system back button)
        layer.shadowColor   = UIColor.black.cgColor
        layer.shadowOpacity = 0.22
        layer.shadowRadius  = 4
        layer.shadowOffset  = CGSize(width: 0, height: 2)

        // Glass capsule container
        glassEffectView.layer.cornerRadius = 10
        glassEffectView.clipsToBounds      = true
        glassEffectView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(glassEffectView)

        NSLayoutConstraint.activate([
            glassEffectView.topAnchor.constraint(equalTo: topAnchor),
            glassEffectView.leadingAnchor.constraint(equalTo: leadingAnchor),
            glassEffectView.trailingAnchor.constraint(equalTo: trailingAnchor),
            glassEffectView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        // Subtle dark translucent tint inside contentView for high contrast against light web content
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

    private let leftCapsule:  GlassCapsuleButton
    private let rightCapsule: GlassCapsuleButton

    private var rightIconName: String
    private var heightConstraint: NSLayoutConstraint?

    init(showLeft: Bool, showRight: Bool, rightIcon: String) {
        self.rightIconName = rightIcon
        self.leftCapsule   = GlassCapsuleButton(sfSymbol: "line.3.horizontal")
        self.rightCapsule  = GlassCapsuleButton(sfSymbol: rightIcon)
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
        leftCapsule.button.addTarget(self, action: #selector(handleLeftTap), for: .touchUpInside)
        leftCapsule.isHidden = !showLeft
        leftCapsule.translatesAutoresizingMaskIntoConstraints = false
        addSubview(leftCapsule)

        rightCapsule.button.addTarget(self, action: #selector(handleRightTap), for: .touchUpInside)
        rightCapsule.isHidden = !showRight
        rightCapsule.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rightCapsule)

        NSLayoutConstraint.activate([
            // Left capsule: pinned to leading edge
            leftCapsule.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            leftCapsule.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
            leftCapsule.widthAnchor.constraint(equalToConstant: 34),
            leftCapsule.heightAnchor.constraint(equalToConstant: 34),

            // Right capsule: pinned to trailing edge
            rightCapsule.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            rightCapsule.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
            rightCapsule.widthAnchor.constraint(equalToConstant: 34),
            rightCapsule.heightAnchor.constraint(equalToConstant: 34),
        ])
    }

    func update(showLeft: Bool?, showRight: Bool?, rightIcon: String?) {
        if let showLeft  { leftCapsule.isHidden  = !showLeft  }
        if let showRight { rightCapsule.isHidden = !showRight }
        if let icon = rightIcon, icon != rightIconName {
            rightIconName = icon
            rightCapsule.updateSymbol(icon)
        }
    }

    @objc private func handleLeftTap()  { onLeftTap?()  }
    @objc private func handleRightTap() { onRightTap?() }
}
