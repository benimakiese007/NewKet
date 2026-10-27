import UIKit
import Capacitor

// MARK: - PassthroughOverlayView

class PassthroughOverlayView: UIView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hitView = super.hitTest(point, with: event)
        return hitView === self ? nil : hitView
    }
}

// MARK: - Plugin Declaration

@objc(NativeHeaderButtonsPlugin)
public class NativeHeaderButtonsPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "NativeHeaderButtonsPlugin"
    public let jsName = "NativeHeaderButtons"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show",      returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide",      returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update",    returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showClose", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideClose", returnType: CAPPluginReturnPromise),
    ]

    private var overlayView: UIView?
    private var closeOverlayView: UIView?

    // MARK: - show

    @objc func show(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else {
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
        guard #available(iOS 16.0, *) else {
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

    // MARK: - showClose (Native Liquid Glass Close "X" Button)

    @objc func showClose(_ call: CAPPluginCall) {
        // Disabled: Close buttons are 100% glued inside HTML drawer/modal headers with Liquid Glass
        call.resolve(["shown": false])
        return;
        guard #available(iOS 16.0, *) else {
            call.resolve(["shown": false])
            return
        }

        let position = call.getString("position") ?? "top-right"
        let topOffset = CGFloat(call.getDouble("topOffset") ?? 12.0)
        let sideOffset = CGFloat(call.getDouble("sideOffset") ?? 16.0)

        DispatchQueue.main.async { [weak self] in
            guard let self,
                  let vc = self.bridge?.viewController,
                  let root = vc.view else {
                call.reject("NativeHeaderButtonsPlugin: rootView not found")
                return
            }

            if self.closeOverlayView != nil {
                call.resolve(["shown": true])
                return
            }

            let container = PassthroughOverlayView()
            container.translatesAutoresizingMaskIntoConstraints = false
            container.backgroundColor = .clear

            let closeBtn = GlassCircleButton(sfSymbol: "xmark", size: 40)
            closeBtn.translatesAutoresizingMaskIntoConstraints = false
            closeBtn.onTap = { [weak self] in
                self?.notifyListeners("closeTap", data: [:])
            }

            container.addSubview(closeBtn)
            root.addSubview(container)

            var constraints: [NSLayoutConstraint] = [
                closeBtn.widthAnchor.constraint(equalToConstant: 40),
                closeBtn.heightAnchor.constraint(equalToConstant: 40),
                closeBtn.topAnchor.constraint(equalTo: container.safeAreaLayoutGuide.topAnchor, constant: topOffset),
                container.topAnchor.constraint(equalTo: root.topAnchor),
                container.bottomAnchor.constraint(equalTo: root.bottomAnchor),
                container.leadingAnchor.constraint(equalTo: root.leadingAnchor),
                container.trailingAnchor.constraint(equalTo: root.trailingAnchor)
            ]

            if position == "top-left" {
                constraints.append(closeBtn.leadingAnchor.constraint(equalTo: container.safeAreaLayoutGuide.leadingAnchor, constant: sideOffset))
            } else {
                constraints.append(closeBtn.trailingAnchor.constraint(equalTo: container.safeAreaLayoutGuide.trailingAnchor, constant: -sideOffset))
            }

            NSLayoutConstraint.activate(constraints)

            closeBtn.alpha = 0
            closeBtn.transform = CGAffineTransform(scaleX: 0.6, y: 0.6)
            UIView.animate(withDuration: 0.28, delay: 0, usingSpringWithDamping: 0.75, initialSpringVelocity: 0.5, options: [.allowUserInteraction]) {
                closeBtn.alpha = 1.0
                closeBtn.transform = .identity
            }

            self.closeOverlayView = container
            call.resolve(["shown": true])
        }
    }

    // MARK: - hideClose

    @objc func hideClose(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let container = self.closeOverlayView else {
                call.resolve(["hidden": true])
                return
            }
            UIView.animate(withDuration: 0.20, delay: 0, options: [.beginFromCurrentState]) {
                container.alpha = 0
                container.transform = CGAffineTransform(scaleX: 0.8, y: 0.8)
            } completion: { _ in
                container.removeFromSuperview()
                if self.closeOverlayView === container {
                    self.closeOverlayView = nil
                }
            }
            call.resolve(["hidden": true])
        }
    }
}

// MARK: - GlassCircleButton (iOS 26+ Interactive Liquid Glass Sphere)

@available(iOS 16.0, *)
class GlassCircleButton: UIView {

    let glassEffectView: UIVisualEffectView
    let button: UIButton
    var onTap: (() -> Void)?

    private let buttonSize: CGFloat
    private let tintLayer = UIView()
    private var initialTouchPoint: CGPoint = .zero
    private var isDragging: Bool = false

    init(sfSymbol: String, size: CGFloat = 48) {
        self.buttonSize = size
        let effect: UIVisualEffect
        if #available(iOS 26.0, *) {
            let glass = UIGlassEffect()
            glass.isInteractive = true
            effect = glass
        } else {
            effect = UIBlurEffect(style: .systemUltraThinMaterial)
        }
        glassEffectView = UIVisualEffectView(effect: effect)
        button = UIButton(type: .system)

        super.init(frame: .zero)

        // Outer shadow for 3D depth elevation
        layer.shadowColor   = UIColor.black.cgColor
        layer.shadowOpacity = 0.22
        layer.shadowRadius  = 5
        layer.shadowOffset  = CGSize(width: 0, height: 2)

        // Perfect circular glass sphere: cornerRadius = size / 2
        glassEffectView.layer.cornerRadius = size / 2
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

        // Translucent tint layer inside contentView for crisp contrast
        tintLayer.backgroundColor = UIColor.clear
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

    /// Expands touch target to at least 44x44pt as recommended by Apple HIG
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        let dx = max(0, (44 - bounds.width) / 2)
        let dy = max(0, (44 - bounds.height) / 2)
        let expanded = bounds.insetBy(dx: -dx, dy: -dy)
        return expanded.contains(point)
    }

    // MARK: - Interactive Liquid Glass Physics (Touch & Compression)

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesBegan(touches, with: event)
        guard let touch = touches.first else { return }
        initialTouchPoint = touch.location(in: self)
        isDragging = true

        // Haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.prepare()
        generator.impactOccurred()

        // Pure glass compression in place (no translation)
        UIView.animate(withDuration: 0.20, delay: 0, usingSpringWithDamping: 0.70, initialSpringVelocity: 0.5, options: [.allowUserInteraction, .beginFromCurrentState]) {
            self.transform = CGAffineTransform(scaleX: 0.94, y: 0.94)
            self.alpha = 0.92
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesMoved(touches, with: event)
        guard isDragging, let touch = touches.first else { return }
        let currentPoint = touch.location(in: self)

        // Stays perfectly fixed in place: simply check if touch is still inside boundary
        let isInside = point(inside: currentPoint, with: event)
        UIView.animate(withDuration: 0.15, delay: 0, options: [.allowUserInteraction, .beginFromCurrentState]) {
            if isInside {
                self.transform = CGAffineTransform(scaleX: 0.94, y: 0.94)
                self.alpha = 0.92
            } else {
                self.transform = .identity
                self.alpha = 1.0
            }
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesEnded(touches, with: event)
        isDragging = false
        guard let touch = touches.first else { return }
        let endPoint = touch.location(in: self)

        // Elastic spring rebound back to resting shape
        UIView.animate(withDuration: 0.38, delay: 0, usingSpringWithDamping: 0.55, initialSpringVelocity: 0.8, options: [.allowUserInteraction, .beginFromCurrentState]) {
            self.transform = .identity
            self.alpha = 1.0
        }

        // Trigger action only if touch ended inside button area
        if point(inside: endPoint, with: event) {
            let feedback = UISelectionFeedbackGenerator()
            feedback.selectionChanged()
            onTap?()
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesCancelled(touches, with: event)
        isDragging = false
        UIView.animate(withDuration: 0.35, delay: 0, usingSpringWithDamping: 0.6, initialSpringVelocity: 0.5, options: [.allowUserInteraction, .beginFromCurrentState]) {
            self.transform = .identity
            self.alpha = 1.0
        }
    }

    func updateSymbol(_ sfSymbol: String) {
        let ptSize: CGFloat = buttonSize < 44 ? 17 : 20
        let symbolConfig = UIImage.SymbolConfiguration(pointSize: ptSize, weight: .semibold)
        let image = UIImage(systemName: sfSymbol, withConfiguration: symbolConfig)

        var config = UIButton.Configuration.plain()
        config.image = image
        config.baseForegroundColor = .white
        config.contentInsets = .zero
        button.configuration = config
        button.tintColor = .white

        let isDestructive = sfSymbol.contains("arrow.right")
        if isDestructive {
            tintLayer.backgroundColor = UIColor { trait in
                trait.userInterfaceStyle == .dark
                    ? UIColor(red: 255/255, green: 69/255, blue: 58/255, alpha: 0.40)
                    : UIColor(red: 255/255, green: 59/255, blue: 48/255, alpha: 0.35)
            }
            layer.shadowColor   = UIColor(red: 255/255, green: 59/255, blue: 48/255, alpha: 0.45).cgColor
            layer.shadowOpacity = 0.35
            layer.shadowRadius  = 6
            layer.shadowOffset  = CGSize(width: 0, height: 2)
        } else {
            tintLayer.backgroundColor = UIColor { trait in
                trait.userInterfaceStyle == .dark
                    ? UIColor.white.withAlphaComponent(0.12)
                    : UIColor.black.withAlphaComponent(0.18)
            }
            layer.shadowColor   = UIColor.black.cgColor
            layer.shadowOpacity = 0.22
            layer.shadowRadius  = 5
            layer.shadowOffset  = CGSize(width: 0, height: 2)
        }
    }
}

// MARK: - NativeHeaderButtonsView (iOS 26+)

@available(iOS 16.0, *)
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
        if let showLeft, leftCircle.isHidden != !showLeft {
            leftCircle.isHidden = !showLeft
        }
        if let showRight, rightCircle.isHidden != !showRight {
            rightCircle.isHidden = !showRight
        }
        if let icon = rightIcon, icon != rightIconName {
            rightIconName = icon
            rightCircle.updateSymbol(icon)
        }
    }

    @objc private func handleLeftTap()  { onLeftTap?()  }
    @objc private func handleRightTap() { onRightTap?() }
}
