import SwiftUI

// MARK: - Colors
extension Color {
    static let newketGreen = Color(hex: "#064734")
    static let newketDark = Color(hex: "#111827") // Tailwind gray-900
    static let newketGray = Color(hex: "#374151") // Tailwind gray-700
    static let newketLightGray = Color(hex: "#F3F4F6") // Tailwind gray-100
}

// MARK: - Typography
struct InterFont {
    static func light(size: CGFloat) -> Font { .custom("Inter-Light", size: size) }
    static func regular(size: CGFloat) -> Font { .custom("Inter-Regular", size: size) }
    static func medium(size: CGFloat) -> Font { .custom("Inter-Medium", size: size) }
    static func semibold(size: CGFloat) -> Font { .custom("Inter-SemiBold", size: size) }
    static func bold(size: CGFloat) -> Font { .custom("Inter-Bold", size: size) }
    static func black(size: CGFloat) -> Font { .custom("Inter-Black", size: size) }
}

// MARK: - Extensions
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
