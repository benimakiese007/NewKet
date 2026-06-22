import SwiftUI

struct NotificationsView: View {
    var body: some View {
        ZStack(alignment: .top) {
            Color(.systemGroupedBackground)
                .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 12) {
                    Spacer().frame(height: 100)
                    
                    NotificationCard(
                        icon: "shippingbox.fill",
                        iconColor: .blue,
                        title: "Commande expédiée",
                        message: "Votre colis Sneakers X est en route. Livraison estimée : demain.",
                        time: "Il y a 2h"
                    )
                    
                    NotificationCard(
                        icon: "cart.fill.badge.plus",
                        iconColor: .green,
                        title: "Nouvelle vente !",
                        message: "Quelqu'un a acheté votre T-Shirt Logo pour 25,00 €.",
                        time: "Il y a 5h"
                    )
                    
                    NotificationCard(
                        icon: "bubble.left.fill",
                        iconColor: .purple,
                        title: "Nouveau message",
                        message: "Vendeur_Pro : \"Bonjour, est-ce toujours disponible ?\"",
                        time: "Hier"
                    )
                    
                    NotificationCard(
                        icon: "star.fill",
                        iconColor: .yellow,
                        title: "Nouvel avis",
                        message: "Un acheteur vous a laissé un avis 5 étoiles ⭐",
                        time: "Il y a 2j"
                    )
                    
                    Spacer().frame(height: 100)
                }
                .padding(.horizontal, 16)
            }
            
            SimpleGlassHeader(title: "Notifications")
        }
    }
}

struct NotificationCard: View {
    let icon: String
    let iconColor: Color
    let title: String
    let message: String
    let time: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 24))
                .foregroundColor(iconColor)
                .frame(width: 40, height: 40)
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    Spacer()
                    Text(time)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(14)
        .modifier(GlassCardModifier())
    }
}

#Preview {
    NotificationsView()
}
