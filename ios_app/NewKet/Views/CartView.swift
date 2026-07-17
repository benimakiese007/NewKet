import SwiftUI

struct CartView: View {
    var body: some View {
        ZStack(alignment: .top) {
            Color.newketLightGray
                .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 20) {
                    Spacer().frame(height: 100)
                    
                    CartItemCard()
                        .padding(.horizontal, 24)
                    
                    Button(action: {}) {
                        Text("PASSER À LA CAISSE (STRIPE)")
                            .font(InterFont.bold(size: 14))
                            .foregroundColor(.white)
                            .tracking(1)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.newketDark)
                            .cornerRadius(12)
                            .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 12)
                    
                    Spacer().frame(height: 120)
                }
            }
            
            SimpleGlassHeader(title: "Mon Panier")
        }
    }
}

struct CartItemCard: View {
    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                Rectangle()
                    .fill(Color.newketLightGray)
                    .frame(width: 80, height: 80)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                
                Image(systemName: "shoe")
                    .font(.system(size: 30))
                    .foregroundColor(.newketGray)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text("NIKE")
                    .font(InterFont.semibold(size: 11))
                    .foregroundColor(.newketGray)
                Text("Sneakers Premium")
                    .font(InterFont.medium(size: 15))
                    .foregroundColor(.newketDark)
                Text("450,00 $")
                    .font(InterFont.bold(size: 16))
                    .foregroundColor(.newketDark)
            }
            Spacer()
            
            Text("x1")
                .font(InterFont.semibold(size: 14))
                .foregroundColor(.newketGray)
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 2)
    }
}

// MARK: - Reusable Glass Header (iOS 17+ compatible)
struct SimpleGlassHeader: View {
    let title: String
    
    var body: some View {
        HStack {
            Text(title)
                .font(InterFont.bold(size: 24))
                .foregroundColor(.newketDark)
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 16)
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
    
    var topSafeArea: CGFloat {
        (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.windows.first?.safeAreaInsets.top ?? 44
    }
}

#Preview {
    CartView()
}
