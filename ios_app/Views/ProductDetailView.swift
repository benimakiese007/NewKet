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
                    // Image Produit (plein écran)
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
            .ignoresSafeArea(.all, edges: .top)
            
            // Bouton Retour Glass
            HStack {
                Button(action: { dismiss() }) {
                    Image(systemName: "chevron.left")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(.primary)
                        .frame(width: 44, height: 44)
                }
                .modifier(GlassCircleModifier())
                
                Spacer()
                
                Button(action: {
                    // Partager
                }) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.title3)
                        .foregroundColor(.primary)
                        .frame(width: 44, height: 44)
                }
                .modifier(GlassCircleModifier())
            }
            .padding(.horizontal, 16)
            .padding(.top, topSafeArea)
            
            // Barre d'achat en bas
            VStack {
                Spacer()
                HStack(spacing: 12) {
                    Button(action: {
                        // Faire une offre
                    }) {
                        Text("Faire une offre")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                    }
                    .buttonStyle(.glass)
                    
                    Button(action: {
                        // Acheter maintenant
                    }) {
                        Text("Acheter")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                    }
                    .buttonStyle(.glassProminent)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 30)
                .modifier(HeaderGlassModifier())
            }
            .ignoresSafeArea(.all, edges: .bottom)
        }
        .navigationBarHidden(true)
    }
    
    var topSafeArea: CGFloat {
        UIApplication.shared.windows.first?.safeAreaInsets.top ?? 44
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

// MARK: - Glass Circle Button Modifier
struct GlassCircleModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content.glassEffect(.regular.interactive(), in: .circle)
        } else {
            content.background(.ultraThinMaterial, in: Circle())
        }
    }
}

#Preview {
    ProductDetailView(product: Product(name: "Sneakers X", price: "120,00 €", imageName: "shoe"))
}
