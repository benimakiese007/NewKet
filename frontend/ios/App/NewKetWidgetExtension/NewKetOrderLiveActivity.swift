import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Colors matching NewKet Brand
@available(iOS 16.1, *)
private struct NewKetTheme {
    static let primaryGreen = Color(red: 0.04, green: 0.29, blue: 0.18)
    static let accentMint   = Color(red: 0.20, green: 0.83, blue: 0.60)
    static let cardDark     = Color(red: 0.07, green: 0.10, blue: 0.15)
    static let trackGray    = Color.white.opacity(0.18)
}

// MARK: - Live Activity Widget
@available(iOS 16.1, *)
public struct NewKetOrderLiveActivity: Widget {

    public init() {}

    public var body: some WidgetConfiguration {
        ActivityConfiguration(for: OrderTrackingAttributes.self) { context in
            // ── Lock Screen / StandBy Banner ───────────────────────────────────
            OrderLockScreenBanner(context: context)
                .activityBackgroundTint(NewKetTheme.cardDark)
                .activitySystemActionForegroundColor(Color.white)

        } dynamicIsland: { context in
            // ── Dynamic Island (iPhone 14 Pro, 15, 16+) ────────────────────────
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: "bag.fill")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(NewKetTheme.accentMint)
                        Text(context.attributes.shopName)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                    }
                    .padding(.leading, 8)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    if let eta = context.state.etaText, !eta.isEmpty {
                        Text(eta)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(NewKetTheme.accentMint)
                            .padding(.trailing, 8)
                    } else {
                        Text(context.attributes.orderNumber)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.white.opacity(0.7))
                            .padding(.trailing, 8)
                    }
                }

                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.statusTitle)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(context.state.statusDescription)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(.white.opacity(0.85))
                            .lineLimit(2)

                        OrderStepperView(
                            currentStep: context.state.currentStep,
                            totalSteps: context.state.totalSteps,
                            isCancelled: context.state.isCancelled
                        )
                        .padding(.top, 4)
                    }
                    .padding(.horizontal, 10)
                    .padding(.bottom, 6)
                }

            } compactLeading: {
                HStack(spacing: 3) {
                    Image(systemName: stepIcon(step: context.state.currentStep))
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(NewKetTheme.accentMint)
                }
                .padding(.leading, 4)

            } compactTrailing: {
                Text(context.state.etaText ?? shortStepTitle(step: context.state.currentStep))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(NewKetTheme.accentMint)
                    .padding(.trailing, 4)

            } minimal: {
                Image(systemName: stepIcon(step: context.state.currentStep))
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(NewKetTheme.accentMint)
            }
        }
    }

    private func stepIcon(step: Int) -> String {
        switch step {
        case 1: return "checkmark.circle.fill"
        case 2: return "shippingbox.fill"
        case 3: return "scooter"
        case 4: return "house.fill"
        default: return "bag.fill"
        }
    }

    private func shortStepTitle(step: Int) -> String {
        switch step {
        case 1: return "Validé"
        case 2: return "Prêt"
        case 3: return "En route"
        case 4: return "Livré"
        default: return "Suivi"
        }
    }
}

// MARK: - Lock Screen Banner View
@available(iOS 16.1, *)
private struct OrderLockScreenBanner: View {
    let context: ActivityViewContext<OrderTrackingAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center) {
                HStack(spacing: 6) {
                    ZStack {
                        Circle()
                            .fill(NewKetTheme.primaryGreen)
                            .frame(width: 26, height: 26)
                        Image(systemName: "bag.fill")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(NewKetTheme.accentMint)
                    }

                    VStack(alignment: .leading, spacing: 1) {
                        Text(context.attributes.shopName)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                        Text(context.attributes.orderNumber)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.white.opacity(0.6))
                    }
                }

                Spacer()

                if let eta = context.state.etaText, !eta.isEmpty {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text("ARRIVÉE ESTIMÉE")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white.opacity(0.5))
                            .tracking(0.5)
                        Text(eta)
                            .font(.system(size: 13, weight: .black))
                            .foregroundColor(NewKetTheme.accentMint)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(context.state.statusTitle)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(context.state.isCancelled ? .red : .white)

                Text(context.state.statusDescription)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(.white.opacity(0.75))
                    .lineLimit(2)
            }

            OrderStepperView(
                currentStep: context.state.currentStep,
                totalSteps: context.state.totalSteps,
                isCancelled: context.state.isCancelled
            )
            .padding(.top, 4)
        }
        .padding(16)
        .background(NewKetTheme.cardDark)
    }
}

// MARK: - Stepper Timeline View
@available(iOS 16.1, *)
private struct OrderStepperView: View {
    let currentStep: Int
    let totalSteps: Int
    let isCancelled: Bool

    private let stepIcons = ["checkmark", "shippingbox", "scooter", "house"]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(0..<4, id: \.self) { index in
                let stepNumber = index + 1
                let isPassed = stepNumber < currentStep
                let isCurrent = stepNumber == currentStep

                ZStack {
                    Circle()
                        .fill(dotColor(isPassed: isPassed, isCurrent: isCurrent))
                        .frame(width: isCurrent ? 26 : 20, height: isCurrent ? 26 : 20)

                    Image(systemName: stepIcons[index])
                        .font(.system(size: isCurrent ? 11 : 9, weight: .bold))
                        .foregroundColor(iconColor(isPassed: isPassed, isCurrent: isCurrent))
                }

                if index < 3 {
                    GeometryReader { geo in
                        Rectangle()
                            .fill(stepNumber < currentStep ? NewKetTheme.accentMint : NewKetTheme.trackGray)
                            .frame(height: 3)
                            .position(x: geo.size.width / 2, y: geo.size.height / 2)
                    }
                    .frame(height: 26)
                }
            }
        }
    }

    private func dotColor(isPassed: Bool, isCurrent: Bool) -> Color {
        if isCancelled { return .red }
        if isCurrent { return NewKetTheme.accentMint }
        if isPassed { return NewKetTheme.primaryGreen }
        return NewKetTheme.trackGray
    }

    private func iconColor(isPassed: Bool, isCurrent: Bool) -> Color {
        if isCurrent { return Color.black }
        if isPassed { return Color.white }
        return Color.white.opacity(0.4)
    }
}
