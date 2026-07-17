import SwiftUI

struct ProfileView: View {
    var body: some View {
        ZStack(alignment: .top) {
            Color.newketLightGray
                .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 20) {
                    Spacer().frame(height: 100)
                    
                    // Avatar + Nom
                    VStack(spacing: 12) {
                        Circle()
                            .fill(Color.gray.opacity(0.2))
                            .frame(width: 90, height: 90)
                            .overlay(
                                Image(systemName: "person.fill")
                                    .font(.system(size: 40))
                                    .foregroundColor(.newketGray)
                            )
                        
                        Text("Utilisateur NewKet")
                            .font(InterFont.bold(size: 20))
                            .foregroundColor(.newketDark)
                        
                        Text("utilisateur@email.com")
                            .font(InterFont.medium(size: 14))
                            .foregroundColor(.newketGray)
                    }
                    .padding(.top, 20)
                    
                    // Section Commandes
                    ProfileSection(title: "Mes commandes") {
                        ProfileRow(icon: "shippingbox.fill", label: "Commandes en cours", color: .newketDark)
                        ProfileRow(icon: "checkmark.circle.fill", label: "Commandes livrées", color: .newketDark)
                        ProfileRow(icon: "arrow.uturn.left.circle.fill", label: "Retours & Litiges", color: .newketDark)
                    }
                    
                    // Section Vente
                    ProfileSection(title: "Mes ventes") {
                        ProfileRow(icon: "tag.fill", label: "Mes annonces", color: .newketDark)
                        ProfileRow(icon: "plus.circle.fill", label: "Vendre un article", color: .newketDark)
                        ProfileRow(icon: "chart.bar.fill", label: "Statistiques", color: .newketDark)
                    }
                    
                    // Section Compte
                    ProfileSection(title: "Mon compte") {
                        ProfileRow(icon: "creditcard.fill", label: "Moyens de paiement", color: .newketDark)
                        ProfileRow(icon: "mappin.circle.fill", label: "Adresses de livraison", color: .newketDark)
                        ProfileRow(icon: "gearshape.fill", label: "Paramètres", color: .newketDark)
                        ProfileRow(icon: "questionmark.circle.fill", label: "Aide & Support", color: .newketDark)
                    }
                    
                    // Bouton Déconnexion
                    Button(action: {
                        // Déconnexion
                    }) {
                        Text("SE DÉCONNECTER")
                            .font(InterFont.bold(size: 14))
                            .foregroundColor(.white)
                            .tracking(1) // uppercase tracking
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color(hex: "#ef4444")) // Tailwind red-500
                            .cornerRadius(12)
                            .shadow(color: .red.opacity(0.2), radius: 8, x: 0, y: 4)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 10)
                    
                    Spacer().frame(height: 120)
                }
            }
            
            SimpleGlassHeader(title: "Mon Profil")
        }
    }
}

// MARK: - Profile Section (Groupe de lignes dans un container)
struct ProfileSection: View {
    let title: String
    let content: () -> AnyView
    
    init<Content: View>(title: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.content = { AnyView(content()) }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(InterFont.semibold(size: 14))
                .foregroundColor(.newketGray)
                .textCase(.uppercase)
                .padding(.horizontal, 24)
                .padding(.bottom, 8)
            
            VStack(spacing: 0) {
                content()
            }
            .background(Color.white)
            .cornerRadius(16)
            .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 2)
            .padding(.horizontal, 24)
        }
        .padding(.bottom, 8)
    }
}

// MARK: - Profile Row
struct ProfileRow: View {
    let icon: String
    let label: String
    let color: Color
    
    var body: some View {
        Button(action: {
            // Navigation
        }) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(color)
                    .frame(width: 24)
                
                Text(label)
                    .font(InterFont.medium(size: 15))
                    .foregroundColor(.newketDark)
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.newketLightGray.opacity(0.8)) // Very light gray to simulate Tailwind border color
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
            
            // Add a separator implicitly via the stack spacing or padding
        }
    }
}

#Preview {
    ProfileView()
}
