import SwiftUI

struct ContentView: View {
    @State private var selectedTab = 0
    
    var body: some View {
        ZStack(alignment: .bottom) {
            // Main Content Area
            Group {
                switch selectedTab {
                case 0:
                    HomeView()
                case 1:
                    SearchView()
                case 2:
                    CatalogueView()
                case 3:
                    CartView()
                case 4:
                    ProfileView()
                default:
                    HomeView()
                }
            }
            .ignoresSafeArea()
            
            // Custom Glass Tab Bar
            if #available(iOS 26, *) {
                GlassTabBar(selectedTab: $selectedTab)
            } else {
                FallbackTabBar(selectedTab: $selectedTab)
            }
        }
    }
}

// MARK: - Glass Tab Bar (iOS 26+)
@available(iOS 26, *)
struct GlassTabBar: View {
    @Binding var selectedTab: Int
    @Namespace private var tabAnimation
    
    var body: some View {
        GlassEffectContainer(spacing: 8) {
            HStack(spacing: 0) {
                // Main capsule containing primary tabs
                HStack(spacing: 6) {
                    TabBarButton(icon: "house.fill", title: "Accueil", index: 0, selectedTab: $selectedTab, animation: tabAnimation)
                    TabBarButton(icon: "square.grid.2x2.fill", title: "Catalogue", index: 2, selectedTab: $selectedTab, animation: tabAnimation)
                    TabBarButton(icon: "cart.fill", title: "Panier", index: 3, selectedTab: $selectedTab, animation: tabAnimation)
                    TabBarButton(icon: "person.fill", title: "Profil", index: 4, selectedTab: $selectedTab, animation: tabAnimation)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 10)
                .glassEffect(.regular, in: .capsule)
                
                // Separate circle for search (like Apple Music's Search tab)
                Button(action: {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                        selectedTab = 1
                    }
                }) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(selectedTab == 1 ? .blue : .primary)
                        .padding(14)
                        .background {
                            if selectedTab == 1 {
                                Circle()
                                    .fill(Color.clear)
                                    .glassEffect(.prominent.interactive())
                                    .glassEffectID("tab_highlight", in: tabAnimation)
                            }
                        }
                }
                .glassEffect(.regular.interactive(), in: .circle)
                .padding(.leading, 8)
            }
        }
        .padding(.bottom, 16)
    }
}

// MARK: - Fallback Tab Bar (iOS 25 and below)
struct FallbackTabBar: View {
    @Binding var selectedTab: Int
    @Namespace private var tabAnimation
    
    var body: some View {
        HStack(spacing: 8) {
            // Main capsule
            HStack(spacing: 6) {
                TabBarButton(icon: "house.fill", title: "Accueil", index: 0, selectedTab: $selectedTab, animation: tabAnimation)
                TabBarButton(icon: "square.grid.2x2.fill", title: "Catalogue", index: 2, selectedTab: $selectedTab, animation: tabAnimation)
                TabBarButton(icon: "cart.fill", title: "Panier", index: 3, selectedTab: $selectedTab, animation: tabAnimation)
                TabBarButton(icon: "person.fill", title: "Profil", index: 4, selectedTab: $selectedTab, animation: tabAnimation)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial, in: Capsule())
            
            // Search button
            Button(action: {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                    selectedTab = 1
                }
            }) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(selectedTab == 1 ? .blue : .primary)
                    .padding(14)
                    .background {
                        if selectedTab == 1 {
                            Circle()
                                .fill(Color.blue.opacity(0.2))
                                .matchedGeometryEffect(id: "tab_highlight", in: tabAnimation)
                        }
                    }
            }
            .background(.ultraThinMaterial, in: Circle())
            .padding(.leading, 8)
        }
        .padding(.bottom, 16)
    }
}

struct TabBarButton: View {
    let icon: String
    let title: String
    let index: Int
    @Binding var selectedTab: Int
    var animation: Namespace.ID
    
    var body: some View {
        Button(action: {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                selectedTab = index
            }
        }) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                Text(title)
                    .font(.caption2)
                    .fontWeight(.medium)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundColor(selectedTab == index ? .blue : .secondary)
            .frame(width: 55)
            .padding(.vertical, 8)
            .background {
                if selectedTab == index {
                    if #available(iOS 26, *) {
                        Capsule()
                            .fill(Color.clear)
                            .glassEffect(.prominent.interactive())
                            .glassEffectID("tab_highlight", in: animation)
                    } else {
                        Capsule()
                            .fill(Color.blue.opacity(0.2))
                            .matchedGeometryEffect(id: "tab_highlight", in: animation)
                    }
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
