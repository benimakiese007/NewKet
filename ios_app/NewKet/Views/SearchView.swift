import SwiftUI

struct SearchView: View {
    @State private var searchText = ""
    
    var body: some View {
        ZStack(alignment: .top) {
            Color.newketLightGray
                .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 20) {
                    Spacer().frame(height: 140)
                    
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
            
            // Search Header (iOS 17+ compatible)
            VStack(spacing: 16) {
                Text("Recherche")
                    .font(InterFont.bold(size: 24))
                    .foregroundColor(.newketDark)
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.newketGray)
                        .font(.system(size: 18))
                    TextField("Que cherchez-vous ?", text: $searchText)
                        .font(InterFont.medium(size: 15))
                        .foregroundColor(.newketDark)
                }
                .padding(14)
                .background(Color.white)
                .cornerRadius(12)
                .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 2)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 20)
            .padding(.top, topSafeArea)
            .background(.ultraThinMaterial)
            .overlay(
                Rectangle()
                    .frame(height: 0.5)
                    .foregroundColor(Color.black.opacity(0.1)),
                alignment: .bottom
            )
            .ignoresSafeArea(edges: .top)
        }
    }
    
    var topSafeArea: CGFloat {
        (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.windows.first?.safeAreaInsets.top ?? 44
    }
}

#Preview {
    SearchView()
}
