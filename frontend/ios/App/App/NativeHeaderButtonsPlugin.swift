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

// MARK: - GlassCircleButton (iOS 26+ Interactive Liquid Glass Sphere)

/// A 38x38pt perfect round circular Liquid Glass sphere conforming to Apple HIG:
/// - Circular UIVisualEffectView container with UIGlassEffect (in: .circle)
/// - Interactive touch & drag fluid physics: compression on touch, rubber-band fluid displacement on drag,
///   and natural Apple spring rebound on release with haptic feedback.
/// - 44x44pt touch hit target for 100% accessible touch responsiveness.
/// - Inner 100% transparent (.plain) button with 16pt semibold SF Symbol.
@available(iOS 26.0, *)
class GlassCircleButton: UIView {

    let glassEffectView: UIVisualEffectView
    let button: UIButton
    var onTap: (() -> Void)?

    private var initialTouchPoint: CGPoint = .zero
    private var isDragging: Bool = false

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

        // Perfect circular glass sphere: cornerRadius = width / 2 (48 / 2 = 24)
        glassEffectView.layer.cornerRadius = 24
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

        // Inner plain button — touches handled on container for fluid physics
        updateSymbol(sfSymbol)
        button.isUserInteractionEnabled = false
        button.translatesAutoresizingMaskIntoConstraints = false
        glassEffectView.contentView.addSubview(button)

        NSLayoutConstraint.activate([
            button.topAnchor.constraint(equalTo: glassEffectView.contentView.topAnchor),
            button.leadingAnchor.constraint(equalTo: glassEffectView.contentView.leadingAnchor),
            button.trailingAnchor.constraint(equalTo: glassEffectView.contentView.trailingAnchor),
            button.bottomAnchor.constraint(equalTo: glassEffectView.contentView.bottomAnchor),
        ])

        isUserInteractionEnabled = true
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    /// Expands touch target to 44x44pt as recommended by Apple HIG
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        let dx = max(0, (48 - bounds.width) / 2)
        let dy = max(0, (48 - bounds.height) / 2)
        let expanded = bounds.insetBy(dx: -dx, dy: -dy)
        return expanded.contains(point)
    }

    // MARK: - Interactive Liquid Glass Physics (Touch & Drag)

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesBegan(touches, with: event)
        guard let touch = touches.first else { return }
        initialTouchPoint = touch.location(in: self)
        isDragging = true

        // Haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.prepare()
        generator.impactOccurred()

        // Fluid depression: compress the glass bubble slightly
        UIView.animate(withDuration: 0.22, delay: 0, usingSpringWithDamping: 0.65, initialSpringVelocity: 0.5, options: [.allowUserInteraction, .beginFromCurrentState]) {
            self.transform = CGAffineTransform(scaleX: 0.90, y: 0.90)
            self.alpha = 0.88
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesMoved(touches, with: event)
        guard isDragging, let touch = touches.first else { return }
        let currentPoint = touch.location(in: self)

        let deltaX = (currentPoint.x - initialTouchPoint.x) * 0.25
        let deltaY = (currentPoint.y - initialTouchPoint.y) * 0.25

        // Rubber-band elastic resistance: limit maximum fluid stretch
        let clampedX = max(-10, min(10, deltaX))
        let clampedY = max(-10, min(10, deltaY))

        UIView.animate(withDuration: 0.1, delay: 0, options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut]) {
            self.transform = CGAffineTransform(translationX: clampedX, y: clampedY).scaledBy(x: 0.92, y: 0.92)
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesEnded(touches, with: event)
        isDragging = false
        guard let touch = touches.first else { return }
        let endPoint = touch.location(in: self)

        // Elastic spring rebound back to original shape
        UIView.animate(withDuration: 0.45, delay: 0, usingSpringWithDamping: 0.48, initialSpringVelocity: 0.8, options: [.allowUserInteraction, .beginFromCurrentState]) {
            self.transform = .identity
            self.alpha = 1.0
        }

        // Trigger action if touch ended inside expanded touch area
        if point(inside: endPoint, with: event) {
            let feedback = UISelectionFeedbackGenerator()
            feedback.selectionChanged()
            onTap?()
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesCancelled(touches, with: event)
        isDragging = false
        UIView.animate(withDuration: 0.4, delay: 0, usingSpringWithDamping: 0.6, initialSpringVelocity: 0.5, options: [.allowUserInteraction, .beginFromCurrentState]) {
            self.transform = .identity
            self.alpha = 1.0
        }
    }

    func updateSymbol(_ sfSymbol: String) {
        let symbolConfig = UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
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

        // Wire taps via interactive fluid closure
        leftCircle.onTap = { [weak self] in
            self?.handleLeftTap()
        }
        leftCircle.isHidden = !showLeft
        leftCircle.translatesAutoresizingMaskIntoConstraints = false
        addSubview(leftCircle)

        rightCircle.onTap = { [weak self] in
            self?.handleRightTap()
        }
        rightCircle.isHidden = !showRight
        rightCircle.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rightCircle)

        NSLayoutConstraint.activate([
            // Left circle: pinned to leading edge, 48x48pt perfect sphere
            leftCircle.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            leftCircle.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
            leftCircle.widthAnchor.constraint(equalToConstant: 48),
            leftCircle.heightAnchor.constraint(equalToConstant: 48),

            // Right circle: pinned to trailing edge, 48x48pt perfect sphere
            rightCircle.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            rightCircle.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
            rightCircle.widthAnchor.constraint(equalToConstant: 48),
            rightCircle.heightAnchor.constraint(equalToConstant: 48),
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
