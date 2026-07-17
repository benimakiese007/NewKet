import SwiftUI

struct MessagesView: View {
    var body: some View {
        ZStack(alignment: .top) {
            Color(.systemGroupedBackground)
                .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 8) {
                    Spacer().frame(height: 100)
                    
                    ConversationRow(
                        name: "Vendeur_Pro",
                        lastMessage: "D'accord, je vous l'envoie demain !",
                        time: "14:32",
                        unread: true
                    )
                    
                    ConversationRow(
                        name: "AcheteurCool",
                        lastMessage: "Merci pour l'achat, bonne réception 🙏",
                        time: "Hier",
                        unread: false
                    )
                    
                    ConversationRow(
                        name: "Support NewKet",
                        lastMessage: "Votre litige a été résolu. Le remboursement est en cours.",
                        time: "Lun.",
                        unread: false
                    )
                    
                    Spacer().frame(height: 100)
                }
                .padding(.horizontal, 16)
            }
            
            SimpleGlassHeader(title: "Messages")
        }
    }
}

struct ConversationRow: View {
    let name: String
    let lastMessage: String
    let time: String
    let unread: Bool
    
    var body: some View {
        Button(action: {
            // Ouvrir la conversation
        }) {
            HStack(spacing: 14) {
                // Avatar
                Circle()
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 50, height: 50)
                    .overlay(
                        Image(systemName: "person.fill")
                            .foregroundColor(.gray)
                    )
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(name)
                            .font(.headline)
                            .foregroundColor(.primary)
                        Spacer()
                        Text(time)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Text(lastMessage)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
                
                if unread {
                    Circle()
                        .fill(.blue)
                        .frame(width: 10, height: 10)
                }
            }
            .padding(14)
        }
        .modifier(GlassCardModifier())
    }
}

#Preview {
    MessagesView()
}
