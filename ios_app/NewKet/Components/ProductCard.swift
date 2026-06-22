import SwiftUI

struct ProductCard: View {
    let product: Product
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Image
            ZStack(alignment: .topTrailing) {
                Rectangle()
                    .fill(Color.newketLightGray)
                    .aspectRatio(0.8, contentMode: .fit)
                    .overlay(
                        Image(systemName: product.imageName)
                            .font(.system(size: 40))
                            .foregroundColor(.newketGray)
                    )
                
                // Cœur favori
                Button(action: {}) {
                    Image(systemName: "heart")
                        .font(.system(size: 16))
                        .foregroundColor(.newketDark)
                        .padding(8)
                        .background(.ultraThinMaterial, in: Circle())
                }
                .padding(8)
            }
            
            // Infos
            VStack(alignment: .leading, spacing: 4) {
                Text(product.brand)
                    .font(InterFont.bold(size: 10))
                    .foregroundColor(.newketGray)
                    .tracking(1)
                
                Text(product.name)
                    .font(InterFont.medium(size: 14))
                    .foregroundColor(.newketDark)
                    .lineLimit(1)
                
                Text(product.price)
                    .font(InterFont.bold(size: 14))
                    .foregroundColor(.newketDark)
                    .padding(.top, 2)
            }
            .padding(12)
        }
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.08), radius: 15, x: 0, y: 4)
    }
}

// MARK: - Glass Card Modifier (Fallback)
struct GlassCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    ZStack {
        Color.newketLightGray.ignoresSafeArea()
        ProductCard(product: Product(name: "T-Shirt NewKet", price: "25,00 €", imageName: "tshirt", brand: "NEWKET"))
            .padding()
    }
}
