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

    public struct HeaderButtonConfig: Equatable {
        public let showLeft: Bool
        public let showRight: Bool
        public let leftIcon: String
        public let rightIcon: String

        public static func == (lhs: HeaderButtonConfig, rhs: HeaderButtonConfig) -> Bool {
            return lhs.showLeft == rhs.showLeft &&
                   lhs.showRight == rhs.showRight &&
                   lhs.leftIcon == rhs.leftIcon &&
                   lhs.rightIcon == rhs.rightIcon
        }
    }

    private var overlayView: UIView?
    private var closeOverlayView: UIView?
    private var currentConfig: HeaderButtonConfig?
    private var pendingConfig: HeaderButtonConfig?
    private var isSwipeInProgress: Bool = false

    // MARK: - Interactive Transition Lifecycle (Swipe-to-Back Apple Music / WhatsApp)

    public func beginInteractiveSwipe() {
        assert(Thread.isMainThread, "Must be called synchronously on main thread")
        self.isSwipeInProgress = true
        self.pendingConfig = nil
    }

    public func updateInteractiveSwipe(progress: CGFloat) {
        // Les boutons restent fermement fixés à l'écran (position stable x=0, y=0)
    }

    public func endInteractiveSwipe(committed: Bool) {
        assert(Thread.isMainThread, "Must be called on main thread")
        self.isSwipeInProgress = false
        if committed {
            // Transition validée à 100% : passage de relais avec morphing vers les boutons de Z
            if let target = self.pendingConfig {
                self.pendingConfig = nil
                if #available(iOS 16.0, *) {
                    self.applyConfig(target, animated: true)
                }
            }
        } else {
            // Transition annulée (feinte) :
            // La demande de Z est immédiatement purgée, l'écran Y reste l'unique maître
            self.pendingConfig = nil
        }
    }

    // MARK: - applyConfig (Morphing & Elastic Spring)

    @available(iOS 16.0, *)
    private func applyConfig(_ config: HeaderButtonConfig, animated: Bool) {
        guard let vc = self.bridge?.viewController,
              let root = vc.view else { return }

        if let current = self.currentConfig, current == config, self.overlayView != nil {
            return
        }

        self.currentConfig = config

        if !config.showLeft && !config.showRight {
            if let overlay = self.overlayView {
                if animated {
                    UIView.animate(withDuration: 0.20, delay: 0, options: [.beginFromCurrentState]) {
                        overlay.alpha = 0
                    } completion: { _ in
                        overlay.removeFromSuperview()
                        if self.overlayView === overlay {
                            self.overlayView = nil
                        }
                    }
                } else {
                    overlay.removeFromSuperview()
                    self.overlayView = nil
                }
            }
            return
        }

        if let existing = self.overlayView as? NativeHeaderButtonsView {
            existing.alpha = 1.0
            existing.update(showLeft: config.showLeft, showRight: config.showRight, leftIcon: config.leftIcon, rightIcon: config.rightIcon, animated: animated)
        } else {
            self.overlayView?.removeFromSuperview()
            self.overlayView = nil

            let overlay = NativeHeaderButtonsView(showLeft: config.showLeft, showRight: config.showRight, leftIcon: config.leftIcon, rightIcon: config.rightIcon)
            overlay.translatesAutoresizingMaskIntoConstraints = false

            overlay.onLeftTap = { [weak self] in
                let icon = overlay.leftIconName
                self?.notifyListeners("burgerTap", data: ["icon": icon])
                if icon.contains("chevron") || icon.contains("arrow") {
                    self?.notifyListeners("backTap", data: ["icon": icon])
                }
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

            if animated {
                overlay.alpha = 0
                overlay.transform = CGAffineTransform(scaleX: 0.94, y: 0.94)
                UIView.animate(withDuration: 0.24, delay: 0.02, usingSpringWithDamping: 0.75, initialSpringVelocity: 0.5, options: [.allowUserInteraction, .beginFromCurrentState]) {
                    overlay.alpha = 1.0
                    overlay.transform = .identity
                }
            } else {
                overlay.alpha = 1.0
            }

            self.overlayView = overlay
        }
    }

    // MARK: - show

    @objc func show(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else {
            call.resolve(["shown": false])
            return
        }

        let showLeft  = call.getBool("showLeft")  ?? true
        let showRight = call.getBool("showRight") ?? true
        let leftIcon  = call.getString("leftIcon")  ?? "line.3.horizontal"
        let rightIcon = call.getString("rightIcon") ?? "magnifyingglass"
        let config = HeaderButtonConfig(showLeft: showLeft, showRight: showRight, leftIcon: leftIcon, rightIcon: rightIcon)

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if self.isSwipeInProgress {
                // Swipe en cours : mise en file d'attente silencieuse (Z ne s'affiche pas encore)
                self.pendingConfig = config
                call.resolve(["shown": true, "pending": true])
                return
            }
            self.applyConfig(config, animated: true)
            call.resolve(["shown": true])
        }
    }

    // MARK: - Programmatic Visibility Control (Swipe-to-Back & Transitions)

    public func setOverlayAlpha(_ alpha: CGFloat, animated: Bool = false, duration: TimeInterval = 0.20) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let overlay = self.overlayView else { return }
            if animated {
                UIView.animate(withDuration: duration, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction]) {
                    overlay.alpha = alpha
                }
            } else {
                overlay.alpha = alpha
            }
        }
    }

    // MARK: - hide

    @objc func hide(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else {
            call.resolve(["hidden": false])
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if self.isSwipeInProgress {
                // Si un swipe est en cours, ne JAMAIS cacher les boutons de l'écran visible (Y)
                call.resolve(["hidden": true, "ignoredDuringSwipe": true])
                return
            }
            let config = HeaderButtonConfig(showLeft: false, showRight: false, leftIcon: "", rightIcon: "")
            self.applyConfig(config, animated: true)
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
        let leftIcon  = call.getString("leftIcon")
        let rightIcon = call.getString("rightIcon")

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let base = self.pendingConfig ?? self.currentConfig ?? HeaderButtonConfig(showLeft: true, showRight: true, leftIcon: "line.3.horizontal", rightIcon: "magnifyingglass")
            let updated = HeaderButtonConfig(
                showLeft: showLeft ?? base.showLeft,
                showRight: showRight ?? base.showRight,
                leftIcon: leftIcon ?? base.leftIcon,
                rightIcon: rightIcon ?? base.rightIcon
            )

            if self.isSwipeInProgress {
                self.pendingConfig = updated
                call.resolve()
                return
            }

            self.applyConfig(updated, animated: true)
            call.resolve()
        }
    }

    // MARK: - showClose (Native Liquid Glass Close "X" Button & Optional Action Button)

    @objc func showClose(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else {
            call.resolve(["shown": false])
            return
        }

        let position = call.getString("position") ?? "top-right"
        let topOffset = CGFloat(call.getDouble("topOffset") ?? 12.0)
        let sideOffset = CGFloat(call.getDouble("sideOffset") ?? 16.0)
        let actionIcon = call.getString("actionIcon")
        let actionType = call.getString("actionType") ?? ""

        DispatchQueue.main.async { [weak self] in
            guard let self,
                  let vc = self.bridge?.viewController,
                  let root = vc.view else {
                call.reject("NativeHeaderButtonsPlugin: rootView not found")
                return
            }

            self.closeOverlayView?.removeFromSuperview()
            self.closeOverlayView = nil

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

            var animatedButtons: [UIView] = [closeBtn]

            if let actionIcon = actionIcon, !actionIcon.isEmpty {
                let actionBtn = GlassCircleButton(sfSymbol: actionIcon, size: 40)
                actionBtn.translatesAutoresizingMaskIntoConstraints = false
                actionBtn.onTap = { [weak self] in
                    self?.notifyListeners("actionTap", data: ["action": actionType])
                }
                container.addSubview(actionBtn)
                animatedButtons.append(actionBtn)

                constraints.append(contentsOf: [
                    actionBtn.widthAnchor.constraint(equalToConstant: 40),
                    actionBtn.heightAnchor.constraint(equalToConstant: 40),
                    actionBtn.centerYAnchor.constraint(equalTo: closeBtn.centerYAnchor),
                    actionBtn.trailingAnchor.constraint(equalTo: closeBtn.leadingAnchor, constant: -10)
                ])
            }

            NSLayoutConstraint.activate(constraints)

            for btn in animatedButtons {
                btn.alpha = 0
                btn.transform = CGAffineTransform(scaleX: 0.6, y: 0.6)
            }

            UIView.animate(withDuration: 0.28, delay: 0, usingSpringWithDamping: 0.75, initialSpringVelocity: 0.5, options: [.allowUserInteraction]) {
                for btn in animatedButtons {
                    btn.alpha = 1.0
                    btn.transform = .identity
                }
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

        layer.shadowColor   = UIColor.black.cgColor
        layer.shadowOpacity = 0.22
        layer.shadowRadius  = 5
        layer.shadowOffset  = CGSize(width: 0, height: 2)

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

        updateSymbol(sfSymbol, animated: false)
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

        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.prepare()
        generator.impactOccurred()

        UIView.animate(withDuration: 0.20, delay: 0, usingSpringWithDamping: 0.70, initialSpringVelocity: 0.5, options: [.allowUserInteraction, .beginFromCurrentState]) {
            self.transform = CGAffineTransform(scaleX: 0.94, y: 0.94)
            self.alpha = 0.92
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesMoved(touches, with: event)
        guard isDragging, let touch = touches.first else { return }
        let currentPoint = touch.location(in: self)

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

        UIView.animate(withDuration: 0.38, delay: 0, usingSpringWithDamping: 0.55, initialSpringVelocity: 0.8, options: [.allowUserInteraction, .beginFromCurrentState]) {
            self.transform = .identity
            self.alpha = 1.0
        }

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

    func updateSymbol(_ sfSymbol: String, animated: Bool = true) {
        let ptSize: CGFloat = buttonSize < 44 ? 17 : 20
        let symbolConfig = UIImage.SymbolConfiguration(pointSize: ptSize, weight: .semibold)
        let image = UIImage(systemName: sfSymbol, withConfiguration: symbolConfig)

        let isDestructive = sfSymbol.contains("arrow.right") || sfSymbol.contains("trash")
        let targetColor: UIColor = isDestructive ? UIColor(red: 255/255, green: 10/255, blue: 10/255, alpha: 1.0) : .white

        let applyChanges = {
            var config = UIButton.Configuration.plain()
            config.image = image
            config.contentInsets = .zero
            config.baseForegroundColor = targetColor
            self.button.configuration = config
            self.button.tintColor = targetColor
            self.updateStyling(isDestructive: isDestructive)
        }

        if animated {
            UIView.transition(with: self.button, duration: 0.22, options: [.transitionCrossDissolve, .allowUserInteraction]) {
                applyChanges()
            }
        } else {
            applyChanges()
        }
    }

    private func updateStyling(isDestructive: Bool) {
        if isDestructive {
            tintLayer.backgroundColor = UIColor { trait in
                trait.userInterfaceStyle == .dark
                    ? UIColor(red: 255/255, green: 10/255, blue: 10/255, alpha: 0.25)
                    : UIColor(red: 255/255, green: 10/255, blue: 10/255, alpha: 0.20)
            }
            layer.shadowColor   = UIColor(red: 255/255, green: 10/255, blue: 10/255, alpha: 0.50).cgColor
            layer.shadowOpacity = 0.40
            layer.shadowRadius  = 7
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

    var leftIconName:  String
    var rightIconName: String
    private var heightConstraint: NSLayoutConstraint?

    init(showLeft: Bool, showRight: Bool, leftIcon: String = "line.3.horizontal", rightIcon: String = "magnifyingglass") {
        self.leftIconName  = leftIcon
        self.rightIconName = rightIcon
        self.leftCircle    = GlassCircleButton(sfSymbol: leftIcon)
        self.rightCircle   = GlassCircleButton(sfSymbol: rightIcon)
        super.init(frame: .zero)
        setupUI(showLeft: showLeft, showRight: showRight)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

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
            leftCircle.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            leftCircle.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
            leftCircle.widthAnchor.constraint(equalToConstant: 48),
            leftCircle.heightAnchor.constraint(equalToConstant: 48),

            rightCircle.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            rightCircle.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
            rightCircle.widthAnchor.constraint(equalToConstant: 48),
            rightCircle.heightAnchor.constraint(equalToConstant: 48),
        ])
    }

    func update(showLeft: Bool?, showRight: Bool?, leftIcon: String? = nil, rightIcon: String? = nil, animated: Bool = true) {
        if let icon = leftIcon, icon != leftIconName {
            leftIconName = icon
            leftCircle.updateSymbol(icon, animated: animated)
        }
        if let icon = rightIcon, icon != rightIconName {
            rightIconName = icon
            rightCircle.updateSymbol(icon, animated: animated)
        }

        if let showLeft {
            let shouldHide = !showLeft
            if leftCircle.isHidden != shouldHide {
                if animated {
                    if shouldHide {
                        UIView.animate(withDuration: 0.18, delay: 0, options: [.beginFromCurrentState]) {
                            self.leftCircle.alpha = 0
                            self.leftCircle.transform = CGAffineTransform(scaleX: 0.88, y: 0.88)
                        } completion: { _ in
                            self.leftCircle.isHidden = true
                            self.leftCircle.transform = .identity
                        }
                    } else {
                        self.leftCircle.alpha = 0
                        self.leftCircle.transform = CGAffineTransform(scaleX: 0.88, y: 0.88)
                        self.leftCircle.isHidden = false
                        UIView.animate(withDuration: 0.24, delay: 0, usingSpringWithDamping: 0.75, initialSpringVelocity: 0.5, options: [.allowUserInteraction]) {
                            self.leftCircle.alpha = 1.0
                            self.leftCircle.transform = .identity
                        }
                    }
                } else {
                    self.leftCircle.isHidden = shouldHide
                    self.leftCircle.alpha = shouldHide ? 0 : 1.0
                }
            }
        }

        if let showRight {
            let shouldHide = !showRight
            if rightCircle.isHidden != shouldHide {
                if animated {
                    if shouldHide {
                        UIView.animate(withDuration: 0.18, delay: 0, options: [.beginFromCurrentState]) {
                            self.rightCircle.alpha = 0
                            self.rightCircle.transform = CGAffineTransform(scaleX: 0.88, y: 0.88)
                        } completion: { _ in
                            self.rightCircle.isHidden = true
                            self.rightCircle.transform = .identity
                        }
                    } else {
                        self.rightCircle.alpha = 0
                        self.rightCircle.transform = CGAffineTransform(scaleX: 0.88, y: 0.88)
                        self.rightCircle.isHidden = false
                        UIView.animate(withDuration: 0.24, delay: 0, usingSpringWithDamping: 0.75, initialSpringVelocity: 0.5, options: [.allowUserInteraction]) {
                            self.rightCircle.alpha = 1.0
                            self.rightCircle.transform = .identity
                        }
                    }
                } else {
                    self.rightCircle.isHidden = shouldHide
                    self.rightCircle.alpha = shouldHide ? 0 : 1.0
                }
            }
        }
    }

    @objc private func handleLeftTap()  { onLeftTap?()  }
    @objc private func handleRightTap() { onRightTap?() }
}
