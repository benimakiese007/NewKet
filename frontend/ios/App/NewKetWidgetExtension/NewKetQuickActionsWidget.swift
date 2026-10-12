import WidgetKit
import SwiftUI

// MARK: - Timeline Provider for Quick Actions Widget
struct NewKetQuickActionsProvider: TimelineProvider {
    func placeholder(in context: Context) -> NewKetQuickActionsEntry {
        NewKetQuickActionsEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (NewKetQuickActionsEntry) -> Void) {
        completion(NewKetQuickActionsEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NewKetQuickActionsEntry>) -> Void) {
        let entry = NewKetQuickActionsEntry(date: Date())
        // Refresh every 3 hours
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 3, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Entry
struct NewKetQuickActionsEntry: TimelineEntry {
    let date: Date
}

// MARK: - Brand Colors
private struct NewKetTheme {
    static let primaryGreen = Color(red: 0.04, green: 0.29, blue: 0.18)   // #0A4A2E
    static let accentMint   = Color(red: 0.20, green: 0.83, blue: 0.60)   // #34D399
    static let cardDark     = Color(red: 0.07, green: 0.10, blue: 0.15)   // #121A26
    static let cardGlass    = Color.white.opacity(0.08)
    static let textMuted    = Color.white.opacity(0.70)
}

// MARK: - Quick Actions Widget Definition
public struct NewKetQuickActionsWidget: Widget {
    public let kind: String = "NewKetQuickActionsWidget"

    public init() {}

    public var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NewKetQuickActionsProvider()) { entry in
            NewKetQuickActionsWidgetView(entry: entry)
        }
        .configurationDisplayName("NewKet Raccourcis")
        .description("Accédez directement aux Boutiques, Notifications, Favoris et à votre Panier.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Main Widget View
struct NewKetQuickActionsWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: NewKetQuickActionsEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallQuickActionsView()
                .widgetBackground()
        case .systemLarge:
            LargeQuickActionsView()
                .widgetBackground()
        default:
            MediumQuickActionsView()
                .widgetBackground()
        }
    }
}

// MARK: - Medium Widget (4 Distinct Tap Links)
private struct MediumQuickActionsView: View {
    var body: some View {
        VStack(spacing: 12) {
            // Header Bar
            HStack {
                HStack(spacing: 6) {
                    Circle()
                        .fill(NewKetTheme.accentMint)
                        .frame(width: 8, height: 8)
                    Text("NewKet")
                        .font(.system(size: 14, weight: .black, design: .rounded))
                        .foregroundColor(.white)
                    Text("Kinshasa")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(NewKetTheme.accentMint)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(NewKetTheme.cardGlass)
                        .cornerRadius(6)
                }

                Spacer()

                Text("Accès Rapide")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(NewKetTheme.textMuted)
            }
            .padding(.horizontal, 4)

            // 4 Quick Action Cards
            HStack(spacing: 8) {
                // 1. Boutique
                QuickActionButton(
                    icon: "bag.fill",
                    label: "Boutiques",
                    color: Color(red: 0.20, green: 0.83, blue: 0.60),
                    url: "newket://shops"
                )

                // 2. Notifications
                QuickActionButton(
                    icon: "bell.fill",
                    label: "Notifs",
                    color: Color(red: 0.98, green: 0.75, blue: 0.18),
                    url: "newket://notifications"
                )

                // 3. Favoris
                QuickActionButton(
                    icon: "heart.fill",
                    label: "Favoris",
                    color: Color(red: 0.95, green: 0.35, blue: 0.45),
                    url: "newket://favorites"
                )

                // 4. Panier
                QuickActionButton(
                    icon: "cart.fill",
                    label: "Panier",
                    color: Color(red: 0.30, green: 0.65, blue: 1.00),
                    url: "newket://achat"
                )
            }
        }
        .padding(14)
    }
}

// MARK: - Small Widget (Compact 2x2 Grid)
private struct SmallQuickActionsView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("NewKet")
                    .font(.system(size: 13, weight: .black, design: .rounded))
                    .foregroundColor(.white)
                Spacer()
                Image(systemName: "sparkles")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(NewKetTheme.accentMint)
            }

            // 2x2 Grid of Actions
            VStack(spacing: 6) {
                HStack(spacing: 6) {
                    SmallActionTile(icon: "bag.fill", label: "Boutique", color: NewKetTheme.accentMint)
                    SmallActionTile(icon: "bell.fill", label: "Notifs", color: Color(red: 0.98, green: 0.75, blue: 0.18))
                }
                HStack(spacing: 6) {
                    SmallActionTile(icon: "heart.fill", label: "Favoris", color: Color(red: 0.95, green: 0.35, blue: 0.45))
                    SmallActionTile(icon: "cart.fill", label: "Panier", color: Color(red: 0.30, green: 0.65, blue: 1.00))
                }
            }
        }
        .padding(12)
        .widgetURL(URL(string: "newket://shops"))
    }
}

// MARK: - Large Widget
private struct LargeQuickActionsView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                HStack(spacing: 6) {
                    Circle()
                        .fill(NewKetTheme.accentMint)
                        .frame(width: 9, height: 9)
                    Text("NewKet")
                        .font(.system(size: 16, weight: .black, design: .rounded))
                        .foregroundColor(.white)
                }
                Spacer()
                Text("Kinshasa Marketplace")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(NewKetTheme.accentMint)
            }

            // Quick Actions Row
            HStack(spacing: 8) {
                QuickActionButton(icon: "bag.fill", label: "Boutiques", color: NewKetTheme.accentMint, url: "newket://shops")
                QuickActionButton(icon: "bell.fill", label: "Notifs", color: Color(red: 0.98, green: 0.75, blue: 0.18), url: "newket://notifications")
                QuickActionButton(icon: "heart.fill", label: "Favoris", color: Color(red: 0.95, green: 0.35, blue: 0.45), url: "newket://favorites")
                QuickActionButton(icon: "cart.fill", label: "Panier", color: Color(red: 0.30, green: 0.65, blue: 1.00), url: "newket://achat")
            }

            Divider()
                .background(Color.white.opacity(0.15))

            // Information banner
            VStack(alignment: .leading, spacing: 6) {
                Text("EXPLORER NEWKET")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(NewKetTheme.accentMint)
                    .tracking(0.5)

                Text("Achetez et faites-vous livrer en direct à Kinshasa en toute sécurité.")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.white.opacity(0.85))
                    .lineLimit(2)
            }
            .padding(10)
            .background(NewKetTheme.cardGlass)
            .cornerRadius(10)

            Spacer()
        }
        .padding(16)
    }
}

// MARK: - Subviews & Buttons
private struct QuickActionButton: View {
    let icon: String
    let label: String
    let color: Color
    let url: String

    var body: some View {
        Link(destination: URL(string: url) ?? URL(string: "newket://")!) {
            VStack(spacing: 6) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(color.opacity(0.20))
                        .frame(height: 44)

                    Image(systemName: icon)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(color)
                }

                Text(label)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .padding(.horizontal, 4)
            .background(NewKetTheme.cardGlass)
            .cornerRadius(14)
        }
    }
}

private struct SmallActionTile: View {
    let icon: String
    let label: String
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(color)
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.white)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 10)
        .background(NewKetTheme.cardGlass)
        .cornerRadius(10)
    }
}

// MARK: - Widget Background ViewModifier
private extension View {
    func widgetBackground() -> some View {
        if #available(iOS 17.0, *) {
            return self.containerBackground(for: .widget) {
                NewKetTheme.cardDark
            }
        } else {
            return self.background(NewKetTheme.cardDark)
        }
    }
}
