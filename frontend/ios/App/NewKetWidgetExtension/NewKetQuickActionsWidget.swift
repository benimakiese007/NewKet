import WidgetKit
import SwiftUI

// MARK: - Models
public struct PinnedProductWidgetModel: Identifiable, Hashable {
    public let id: String
    public let name: String
    public let formattedPrice: String
    public let imageData: Data?
}

// MARK: - Entry
struct NewKetQuickActionsEntry: TimelineEntry {
    let date: Date
    let products: [PinnedProductWidgetModel]
}

// MARK: - Brand Colors (Apple HIG Minimalist White Theme)
private struct NewKetTheme {
    static let primaryGreen   = Color(red: 0.04, green: 0.29, blue: 0.18)   // #0A4A2E
    static let accentMint     = Color(red: 0.04, green: 0.55, blue: 0.35)   // #0A8C59 Émeraude
    static let cardBackground = Color.white                                 // #FFFFFF Fond Blanc Pur
    static let cardGlass      = Color.black.opacity(0.04)                   // Surface neutre subtile
    static let cardBorder     = Color.black.opacity(0.08)                   // Bordure ultra-fine
    static let textPrimary    = Color(red: 0.07, green: 0.10, blue: 0.15)   // #121A26
    static let textMuted      = Color(red: 0.45, green: 0.50, blue: 0.58)   // Gris neutre
}

// MARK: - Timeline Provider
struct NewKetQuickActionsProvider: TimelineProvider {
    
    private static let placeholderProducts: [PinnedProductWidgetModel] = [
        PinnedProductWidgetModel(id: "1", name: "Table basse bois flotté", formattedPrice: "210 000 FC", imageData: nil),
        PinnedProductWidgetModel(id: "2", name: "Canapé 3 places velours", formattedPrice: "950 000 FC", imageData: nil),
        PinnedProductWidgetModel(id: "3", name: "Plante palmier 180cm", formattedPrice: "75 000 FC", imageData: nil),
        PinnedProductWidgetModel(id: "4", name: "Vélo de route carbone", formattedPrice: "2 500 000 FC", imageData: nil),
    ]

    func placeholder(in context: Context) -> NewKetQuickActionsEntry {
        NewKetQuickActionsEntry(date: Date(), products: Self.placeholderProducts)
    }

    func getSnapshot(in context: Context, completion: @escaping (NewKetQuickActionsEntry) -> Void) {
        if context.isPreview {
            completion(NewKetQuickActionsEntry(date: Date(), products: Self.placeholderProducts))
            return
        }
        Task {
            let products = await fetchPinnedProducts()
            let list = products.isEmpty ? Self.placeholderProducts : products
            completion(NewKetQuickActionsEntry(date: Date(), products: list))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NewKetQuickActionsEntry>) -> Void) {
        Task {
            let products = await fetchPinnedProducts()
            let list = products.isEmpty ? Self.placeholderProducts : products
            let entry = NewKetQuickActionsEntry(date: Date(), products: list)
            // Refresh every 30 minutes
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }

    // MARK: - Supabase Fetcher
    private func fetchPinnedProducts() async -> [PinnedProductWidgetModel] {
        let endpoint = "https://kuygjocnnlvjtoaquicq.supabase.co/rest/v1/products?select=id,name,price,image,pinned,stock&pinned=eq.true&is_archived=eq.false&stock=gt.0&order=created_at.desc&limit=4"
        guard let url = URL(string: endpoint) else { return [] }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eWdqb2Nubmx2anRvYXF1aWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDM2NjYsImV4cCI6MjA4NjkxOTY2Nn0.1qyGb91CbLeSRNWKUNGiToJYGr8lsI-DeddWTnMv3SY"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 8

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                return []
            }

            struct RawItem: Decodable {
                let id: String
                let name: String
                let price: Double
                let image: String?
            }

            let items = try JSONDecoder().decode([RawItem].self, from: data)

            var models: [PinnedProductWidgetModel] = []
            for item in items.prefix(4) {
                let formatted = formatPriceFC(item.price)
                var imgData: Data? = nil

                if let rawImg = item.image?.split(separator: ",").first.map(String.init),
                   !rawImg.isEmpty {
                    // Cloudinary optimization: 200x200 thumbnail JPG, ~10KB
                    let transformed = rawImg.replacingOccurrences(
                        of: "/image/upload/",
                        with: "/image/upload/w_200,h_200,c_fill,q_auto,f_jpg/"
                    )
                    if let imgUrl = URL(string: transformed) {
                        do {
                            let (d, _) = try await URLSession.shared.data(from: imgUrl)
                            imgData = d
                        } catch {
                            // Fallback to nil image
                        }
                    }
                }

                models.append(PinnedProductWidgetModel(
                    id: item.id,
                    name: item.name,
                    formattedPrice: formatted,
                    imageData: imgData
                ))
            }
            return models
        } catch {
            return []
        }
    }

    private func formatPriceFC(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = " "
        formatter.maximumFractionDigits = 0
        let str = formatter.string(from: NSNumber(value: amount)) ?? "\(Int(amount))"
        return "\(str) FC"
    }
}

// MARK: - Quick Actions Widget Definition
public struct NewKetQuickActionsWidget: Widget {
    public let kind: String = "NewKetQuickActionsWidget"

    public init() {}

    public var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NewKetQuickActionsProvider()) { entry in
            NewKetQuickActionsWidgetView(entry: entry)
        }
        .configurationDisplayName("NewKet")
        .description("Accédez directement à vos boutiques, panier et découvrez les produits sponsorisés.")
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
            LargeSponsoredShowcaseView(entry: entry)
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
                        .foregroundColor(NewKetTheme.textPrimary)
                    Text("Market")
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
                QuickActionButton(
                    icon: "bag.fill",
                    label: "Boutiques",
                    color: Color(red: 0.20, green: 0.83, blue: 0.60),
                    url: "newket://shops"
                )
                QuickActionButton(
                    icon: "bell.fill",
                    label: "Notifs",
                    color: Color(red: 0.98, green: 0.75, blue: 0.18),
                    url: "newket://notifications"
                )
                QuickActionButton(
                    icon: "heart.fill",
                    label: "Favoris",
                    color: Color(red: 0.95, green: 0.35, blue: 0.45),
                    url: "newket://favorites"
                )
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
                    .foregroundColor(NewKetTheme.textPrimary)
                Spacer()
                Image(systemName: "sparkles")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(NewKetTheme.accentMint)
            }

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

// MARK: - Large Widget: Produits Sponsorisés & En Vedette (Apple HIG Minimalist)
private struct LargeSponsoredShowcaseView: View {
    let entry: NewKetQuickActionsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header Bar (No Emojis - Pure SF Symbol & Typography)
            HStack(alignment: .center) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(NewKetTheme.accentMint)
                        .frame(width: 7, height: 7)
                    Text("NewKet")
                        .font(.system(size: 14, weight: .black, design: .rounded))
                        .foregroundColor(NewKetTheme.textPrimary)
                }

                Text("SPONSORISÉ")
                    .font(.system(size: 8.5, weight: .bold))
                    .tracking(0.6)
                    .foregroundColor(NewKetTheme.accentMint)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(NewKetTheme.accentMint.opacity(0.12))
                    .cornerRadius(4)

                Spacer()

                Link(destination: URL(string: "newket://shops")!) {
                    HStack(spacing: 3) {
                        Text("Boutiques")
                            .font(.system(size: 10.5, weight: .semibold))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 8.5, weight: .bold))
                    }
                    .foregroundColor(NewKetTheme.textMuted)
                }
            }

            // 2x2 Grid of Sponsored Products
            let products = Array(entry.products.prefix(4))
            let firstRow = Array(products.prefix(2))
            let secondRow = products.count > 2 ? Array(products.dropFirst(2).prefix(2)) : []

            VStack(spacing: 7) {
                HStack(spacing: 7) {
                    ForEach(firstRow) { item in
                        SponsoredProductTile(product: item)
                    }
                }
                if !secondRow.isEmpty {
                    HStack(spacing: 7) {
                        ForEach(secondRow) { item in
                            SponsoredProductTile(product: item)
                        }
                    }
                }
            }

            Spacer(minLength: 2)

            // Bottom Quick Actions Bar (Compact & Minimalist)
            HStack(spacing: 5) {
                BottomQuickActionPill(icon: "bag", label: "Boutique", url: "newket://shops")
                BottomQuickActionPill(icon: "bell", label: "Notifs", url: "newket://notifications")
                BottomQuickActionPill(icon: "heart", label: "Favoris", url: "newket://favorites")
                BottomQuickActionPill(icon: "cart", label: "Panier", url: "newket://achat")
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 12)
        .padding(.bottom, 10)
    }
}

// MARK: - Sponsored Product Card
private struct SponsoredProductTile: View {
    let product: PinnedProductWidgetModel

    var body: some View {
        Link(destination: URL(string: "newket://product?id=\(product.id)") ?? URL(string: "newket://shops")!) {
            VStack(alignment: .leading, spacing: 4) {
                // Product Image Container (Strictly Clipped)
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(NewKetTheme.cardGlass)

                    if let data = product.imageData, let uiImage = UIImage(data: data) {
                        Image(uiImage: uiImage)
                            .resizable()
                            .scaledToFill()
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        Image(systemName: "bag")
                            .font(.system(size: 18, weight: .light))
                            .foregroundColor(NewKetTheme.textMuted.opacity(0.6))
                    }
                }
                .frame(height: 74)
                .clipped()
                .cornerRadius(8)

                // Product Details (Separated below image)
                VStack(alignment: .leading, spacing: 1) {
                    Text(product.name)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(NewKetTheme.textPrimary)
                        .lineLimit(1)

                    Text(product.formattedPrice)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(NewKetTheme.accentMint)
                        .lineLimit(1)
                }
                .padding(.horizontal, 2)
                .padding(.bottom, 2)
            }
            .padding(5)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
            .cornerRadius(11)
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(NewKetTheme.cardBorder, lineWidth: 0.8)
            )
        }
    }
}

// MARK: - Bottom Quick Action Pill
private struct BottomQuickActionPill: View {
    let icon: String
    let label: String
    let url: String

    var body: some View {
        Link(destination: URL(string: url) ?? URL(string: "newket://")!) {
            HStack(spacing: 3) {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .semibold))
                Text(label)
                    .font(.system(size: 9.5, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .foregroundColor(NewKetTheme.textPrimary)
            .frame(maxWidth: .infinity)
            .frame(height: 28)
            .background(NewKetTheme.cardGlass)
            .cornerRadius(8)
        }
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
                        .fill(color.opacity(0.15))
                        .frame(height: 44)

                    Image(systemName: icon)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(color)
                }

                Text(label)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(NewKetTheme.textPrimary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .padding(.horizontal, 4)
            .background(Color.black.opacity(0.03))
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
                .foregroundColor(NewKetTheme.textPrimary)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 10)
        .background(Color.black.opacity(0.04))
        .cornerRadius(10)
    }
}

// MARK: - Widget Background ViewModifier
private extension View {
    @ViewBuilder
    func widgetBackground() -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(for: .widget) {
                NewKetTheme.cardBackground
            }
        } else {
            self.background(NewKetTheme.cardBackground)
        }
    }
}
