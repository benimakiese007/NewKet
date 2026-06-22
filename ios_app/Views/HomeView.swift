import SwiftUI

struct HomeView: View {
    @StateObject private var viewModel = HomeViewModel()
    
    var body: some View {
        NavigationView {
            ZStack(alignment: .top) {
                Color.white.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 0) {
                        // Header Spacing
                        Spacer().frame(height: 100)
                        
                        // Hero Section
                        HeroSection()
                        
                        // Pinned Products Section
                        PinnedProductsSection(products: viewModel.pinnedProducts, isLoading: viewModel.isLoading)
                            .padding(.top, 48)
                        
                        Spacer().frame(height: 120) // Tab Bar Spacing
                    }
                }
                .task {
                    await viewModel.fetchPinnedProducts()
                }
                
                // Header
                if #available(iOS 26, *) {
                    GlassHeader()
                } else {
                    FallbackHeader()
                }
            }
            .navigationBarHidden(true)
        }
    }
}

struct HeroSection: View {
    var body: some View {
        ZStack {
            // Background Image
            AsyncImage(url: URL(string: "https://newket.vercel.app/Images/marketplace-hero.jpg")) { image in
                image.resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Color.newketDark
            }
            .frame(height: 500)
            .clipped()
            
            // Dark Gradient Overlay matching Web's linear-gradient
            LinearGradient(
                gradient: Gradient(colors: [Color.black.opacity(0.4), Color.black.opacity(0.4)]),
                startPoint: .top,
                endPoint: .bottom
            )
            
            // Blur effect
            Color.black.opacity(0.5)
                .background(.ultraThinMaterial)
                .opacity(0.1) // Subtle blur overlay
            
            VStack(alignment: .center, spacing: 24) {
                VStack(spacing: -10) {
                    Text("SUBTILE")
                        .font(InterFont.black(size: 48))
                        .foregroundColor(.white)
                        .tracking(-2) // tracking-tighter
                    Text("ÉLÉGANCE.")
                        .font(InterFont.black(size: 48))
                        .foregroundColor(Color(white: 0.8)) // text-gray-300
                        .tracking(-2) // tracking-tighter
                }
                .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)
                
                Text("L'excellence du luxe à portée de main. Découvrez une sélection curatée des plus belles pièces du moment.")
                    .font(InterFont.medium(size: 16))
                    .foregroundColor(Color.white.opacity(0.9))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                    .lineSpacing(4) // leading-relaxed
                
                Button(action: {
                    // Action
                }) {
                    Text("DÉCOUVRIR LA COLLECTION")
                        .font(InterFont.black(size: 15))
                        .foregroundColor(.black)
                        .padding(.vertical, 20)
                        .padding(.horizontal, 48)
                        .background(Color.white)
                        .cornerRadius(16)
                        .shadow(color: .black.opacity(0.3), radius: 15, x: 0, y: 10)
                        .tracking(3) // uppercase tracking-[0.2em]
                }
                .padding(.top, 8)
                
                HStack(spacing: 4) {
                    Text("Vous possédez une pièce rare ?")
                        .font(InterFont.medium(size: 14))
                        .foregroundColor(Color.white.opacity(0.7))
                    
                    Text("Vendez-la")
                        .font(InterFont.bold(size: 14))
                        .foregroundColor(.white)
                        .underline()
                }
                .padding(.top, 8)
            }
        }
        .frame(height: 500)
        .cornerRadius(24)
        .padding(.horizontal, 16)
        .shadow(color: .black.opacity(0.2), radius: 24, x: 0, y: 12)
    }
}

struct PinnedProductsSection: View {
    let products: [SupabaseProduct]
    let isLoading: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack {
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.black)
                            .frame(width: 32, height: 32)
                            .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
                        Image(systemName: "pin.fill")
                            .foregroundColor(.white)
                            .font(.system(size: 14, weight: .bold))
                    }
                    Text("Produits Sponsorisés")
                        .font(InterFont.bold(size: 20))
                        .foregroundColor(.newketDark)
                }
                
                Spacer()
                
                Button(action: {}) {
                    HStack(spacing: 4) {
                        Text("Voir tout")
                            .font(InterFont.bold(size: 14))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundColor(.newketDark)
                }
            }
            .padding(.horizontal, 24)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    if isLoading {
                        // Skeleton Loaders
                        ForEach(0..<3) { _ in
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color.newketLightGray)
                                .frame(width: 180, height: 260)
                                .overlay(ProgressView())
                        }
                    } else if products.isEmpty {
                        Text("Aucun produit sponsorisé.")
                            .font(InterFont.medium(size: 14))
                            .foregroundColor(.newketGray)
                            .padding(.vertical, 40)
                    } else {
                        ForEach(products, id: \.id) { product in
                            SupabaseProductCard(product: product)
                                .frame(width: 180) // Fixed width for horizontal scroll like web
                        }
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 20)
            }
        }
    }
}

// MARK: - Glass Header
@available(iOS 26, *)
struct GlassHeader: View {
    var body: some View {
        HStack {
            Text("NewKet")
                .font(InterFont.bold(size: 24))
                .foregroundColor(.newketDark)
            Spacer()
            Image(systemName: "bell.fill")
                .font(.title2)
                .foregroundColor(.newketDark)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 16)
        .padding(.top, topSafeArea)
        .glassEffect(.regular, in: .rect(bottomLeadingRadius: 24, bottomTrailingRadius: 24))
        .ignoresSafeArea(.all, edges: .top)
    }
    
    var topSafeArea: CGFloat {
        UIApplication.shared.windows.first?.safeAreaInsets.top ?? 44
    }
}

// MARK: - Fallback Header
struct FallbackHeader: View {
    var body: some View {
        HStack {
            Text("NewKet")
                .font(InterFont.bold(size: 24))
                .foregroundColor(.newketDark)
            Spacer()
            Image(systemName: "bell.fill")
                .font(.title2)
                .foregroundColor(.newketDark)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 16)
        .padding(.top, topSafeArea)
        .background(.ultraThinMaterial)
        .ignoresSafeArea(.all, edges: .top)
    }
    
    var topSafeArea: CGFloat {
        UIApplication.shared.windows.first?.safeAreaInsets.top ?? 44
    }
}
