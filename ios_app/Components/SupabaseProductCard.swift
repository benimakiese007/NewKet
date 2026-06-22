import SwiftUI

struct SupabaseProductCard: View {
    let product: SupabaseProduct
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Product Image
            ZStack(alignment: .topTrailing) {
                if let url = product.firstImageURL {
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .aspectRatio(1.0, contentMode: .fill)
                            .clipped()
                    } placeholder: {
                        Rectangle()
                            .fill(Color.newketLightGray)
                            .aspectRatio(1.0, contentMode: .fit)
                            .overlay(ProgressView())
                    }
                } else {
                    Rectangle()
                        .fill(Color.newketLightGray)
                        .aspectRatio(1.0, contentMode: .fit)
                        .overlay(
                            Image(systemName: "photo")
                                .font(.system(size: 40))
                                .foregroundColor(.newketGray)
                        )
                }
                
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
                Text(product.category ?? "Marque")
                    .font(InterFont.semibold(size: 11))
                    .foregroundColor(.newketGray)
                    .textCase(.uppercase)
                
                Text(product.name)
                    .font(InterFont.medium(size: 14))
                    .foregroundColor(.newketDark)
                    .lineLimit(1)
                
                Text(product.formattedPrice)
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
