import SwiftUI

struct CatalogueView: View {
    let categories = [
        "Vêtements", 
        "Chaussures", 
        "Accessoires", 
        "Électronique", 
        "Maison"
    ]
    
    var body: some View {
        ZStack(alignment: .top) {
            Color.newketLightGray
                .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 16) {
                    Spacer().frame(height: 100) // Espace pour le header
                    
                    HStack {
                        Text("Catégories")
                            .font(InterFont.bold(size: 24))
                            .foregroundColor(.newketDark)
                        Spacer()
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 8)
                    
                    ForEach(categories, id: \.self) { category in
                        Button(action: {
                            // Aller à la catégorie
                        }) {
                            HStack {
                                Text(category)
                                    .font(InterFont.semibold(size: 16))
                                    .foregroundColor(.newketDark)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.newketGray)
                            }
                            .padding(.vertical, 20)
                            .padding(.horizontal, 24)
                            .background(Color.white)
                            .cornerRadius(16)
                            .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 2)
                        }
                    }
                    .padding(.horizontal, 24)
                    
                    Spacer().frame(height: 120) // Tab Bar Spacing
                }
            }
            
            // Header
            if #available(iOS 26, *) {
                GlassHeader()
            } else {
                FallbackHeader()
            }
        }
    }
}

#Preview {
    CatalogueView()
}
