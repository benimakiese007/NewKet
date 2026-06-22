import SwiftUI

struct SearchView: View {
    @State private var searchText = ""
    
    var body: some View {
        ZStack(alignment: .top) {
            Color.newketLightGray
                .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 20) {
                    Spacer().frame(height: 140) // Espace pour le header et la barre de recherche
                    
                    // Contenu principal de recherche
                    VStack(spacing: 16) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 48))
                            .foregroundColor(.newketGray.opacity(0.5))
                        Text("Recherchez des produits sur NewKet")
                            .font(InterFont.medium(size: 15))
                            .foregroundColor(.newketGray)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 60)
                    
                    Spacer().frame(height: 120)
                }
            }
            
            // Glass Search Header
            if #available(iOS 26, *) {
                GlassSearchHeader(text: $searchText)
            } else {
                FallbackSearchHeader(text: $searchText)
            }
        }
    }
}

// MARK: - Glass Search Header (iOS 26+)
@available(iOS 26, *)
struct GlassSearchHeader: View {
    @Binding var text: String
    
    var body: some View {
        VStack(spacing: 16) {
            Text("Recherche")
                .font(InterFont.bold(size: 24))
                .foregroundColor(.newketDark)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.newketGray)
                    .font(.system(size: 18))
                TextField("Que cherchez-vous ?", text: $text)
                    .font(InterFont.medium(size: 15))
                    .foregroundColor(.newketDark)
            }
            .padding(14)
            .background(Color.white.opacity(0.8))
            .cornerRadius(12)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 20)
        .padding(.top, topSafeArea)
        .glassEffect(.regular.interactive(), in: .rect(bottomLeadingRadius: 24, bottomTrailingRadius: 24))
        .ignoresSafeArea(.all, edges: .top)
    }
    
    var topSafeArea: CGFloat {
        UIApplication.shared.windows.first?.safeAreaInsets.top ?? 44
    }
}

// MARK: - Fallback Search Header
struct FallbackSearchHeader: View {
    @Binding var text: String
    
    var body: some View {
        VStack(spacing: 16) {
            Text("Recherche")
                .font(InterFont.bold(size: 24))
                .foregroundColor(.newketDark)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.newketGray)
                    .font(.system(size: 18))
                TextField("Que cherchez-vous ?", text: $text)
                    .font(InterFont.medium(size: 15))
                    .foregroundColor(.newketDark)
            }
            .padding(14)
            .background(Color.white)
            .cornerRadius(12)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 20)
        .padding(.top, topSafeArea)
        .background(.ultraThinMaterial)
        .ignoresSafeArea(.all, edges: .top)
    }
    
    var topSafeArea: CGFloat {
        UIApplication.shared.windows.first?.safeAreaInsets.top ?? 44
    }
}

#Preview {
    SearchView()
}
