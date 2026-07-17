import SwiftUI

struct Product {
    let id: UUID = UUID()
    let name: String
    let price: String
    let imageName: String
    var brand: String = "Marque" // Added brand property
}

struct ProductCard: View {
    let product: Product
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Product Image
            ZStack(alignment: .topTrailing) {
                Rectangle()
                    .fill(Color.newketLightGray)
                    .aspectRatio(1.0, contentMode: .fit)
                    .overlay(
                        Image(systemName: product.imageName)
                            .font(.system(size: 40))
                            .foregroundColor(.newketGray)
                    )
                
                // Favorite Button
                Button(action: {}) {
                    Image(systemName: "heart")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.newketDark)
                        .padding(8)
                        .background(Color.white)
                        .clipShape(Circle())
                        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
                }
                .padding(12)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(product.brand)
                    .font(InterFont.semibold(size: 11))
                    .foregroundColor(.newketGray)
                    .textCase(.uppercase)
                
                Text(product.name)
                    .font(InterFont.medium(size: 14))
                    .foregroundColor(.newketDark)
                    .lineLimit(1)
                
                Text(product.price)
                    .font(InterFont.bold(size: 16))
                    .foregroundColor(.newketDark)
                    .padding(.top, 4)
            }
            .padding(16)
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.08), radius: 15, x: 0, y: 4) // Exact Tailwind shadow-lg
    }
}

// MARK: - Glass Card Modifier (Legacy kept for other parts if needed)
struct GlassCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content
                .glassEffect(.regular, in: .rect(cornerRadius: 16))
        } else {
            content
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        }
    }
}

#Preview {
    ZStack {
        Color.newketLightGray.ignoresSafeArea()
        ProductCard(product: Product(name: "T-Shirt NewKet", price: "25,00 €", imageName: "tshirt", brand: "NEWKET"))
            .frame(width: 200)
    }
}
