import SwiftUI

struct ProductDetailView: View {
    let product: Product
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        ZStack(alignment: .top) {
            Color(.systemGroupedBackground)
                .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 0) {
                    // Image Produit
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 400)
                        .overlay(
                            Image(systemName: product.imageName)
                                .font(.system(size: 80))
                                .foregroundColor(.gray)
                        )
                    
                    // Infos Produit
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Text(product.name)
                                .font(.title)
                                .fontWeight(.bold)
                            Spacer()
                            Text(product.price)
                                .font(.title2)
                                .fontWeight(.semibold)
                                .foregroundColor(.blue)
                        }
                        
                        // Vendeur
                        HStack(spacing: 12) {
                            Circle()
                                .fill(Color.gray.opacity(0.3))
                                .frame(width: 40, height: 40)
                                .overlay(
                                    Image(systemName: "person.fill")
                                        .foregroundColor(.gray)
                                )
                            VStack(alignment: .leading) {
                                Text("Vendeur_NewKet")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                HStack(spacing: 4) {
                                    Image(systemName: "star.fill")
                                        .font(.caption)
                                        .foregroundColor(.yellow)
                                    Text("4.8 (127 avis)")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            Spacer()
                        }
                        .padding(12)
                        .modifier(GlassCardModifier())
                        
                        // Description
                        Text("Description")
                            .font(.headline)
                        
                        Text("Article en excellent état, porté quelques fois. Taille M. Livraison rapide sous 48h via Colissimo.")
                            .foregroundColor(.secondary)
                            .lineSpacing(4)
                        
                        // Détails
                        VStack(spacing: 12) {
                            DetailRow(label: "État", value: "Très bon état")
                            DetailRow(label: "Taille", value: "M")
                            DetailRow(label: "Couleur", value: "Noir")
                            DetailRow(label: "Marque", value: "NewKet Original")
                            DetailRow(label: "Livraison", value: "Colissimo 48h")
                        }
                        .padding(16)
                        .modifier(GlassCardModifier())
                        
                        // Protection Acheteur
                        HStack(spacing: 12) {
                            Image(systemName: "shield.checkered")
                                .font(.title2)
                                .foregroundColor(.green)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Protection Acheteur")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                Text("Paiement sécurisé via AvadaPay avec escrow")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(12)
                        .modifier(GlassCardModifier())
                        
                        Spacer().frame(height: 100)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 20)
                }
            }
            .ignoresSafeArea(edges: .top)
            
            // Boutons de navigation (Retour / Partager)
            HStack {
                Button(action: { dismiss() }) {
                    Image(systemName: "chevron.left")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(.primary)
                        .frame(width: 44, height: 44)
                }
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().stroke(Color.white.opacity(0.3), lineWidth: 0.5))
                
                Spacer()
                
                Button(action: {}) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.title3)
                        .foregroundColor(.primary)
                        .frame(width: 44, height: 44)
                }
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().stroke(Color.white.opacity(0.3), lineWidth: 0.5))
            }
            .padding(.horizontal, 16)
            .padding(.top, topSafeArea)
            
            // Barre d'achat en bas
            VStack {
                Spacer()
                HStack(spacing: 12) {
                    Button(action: {}) {
                        Text("Faire une offre")
                            .font(.headline)
                            .foregroundColor(.newketDark)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.white)
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.newketDark, lineWidth: 1))
                    }
                    
                    Button(action: {}) {
                        Text("Acheter")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.newketDark)
                            .cornerRadius(12)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
                .background(.ultraThinMaterial)
                .overlay(
                    Rectangle()
                        .frame(height: 0.5)
                        .foregroundColor(Color.black.opacity(0.1)),
                    alignment: .top
                )
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .navigationBarHidden(true)
    }
    
    var topSafeArea: CGFloat {
        (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.windows.first?.safeAreaInsets.top ?? 44
    }
}

// MARK: - Detail Row
struct DetailRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}

#Preview {
    ProductDetailView(product: Product(name: "Sneakers X", price: "120,00 €", imageName: "shoe"))
}
