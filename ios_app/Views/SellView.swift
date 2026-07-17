import SwiftUI

struct SellView: View {
    @State private var title = ""
    @State private var price = ""
    @State private var description = ""
    @State private var selectedCategory = "Vêtements"
    @State private var selectedCondition = "Neuf"
    @State private var selectedSize = "M"
    
    let categories = ["Vêtements", "Chaussures", "Accessoires", "Électronique", "Maison", "Autre"]
    let conditions = ["Neuf", "Très bon état", "Bon état", "Satisfaisant"]
    let sizes = ["XS", "S", "M", "L", "XL", "XXL", "Unique"]
    
    var body: some View {
        ZStack(alignment: .top) {
            Color(.systemGroupedBackground)
                .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 20) {
                    Spacer().frame(height: 100)
                    
                    // Zone Photo
                    VStack(spacing: 12) {
                        Button(action: {
                            // Ouvrir la caméra / galerie
                        }) {
                            VStack(spacing: 12) {
                                Image(systemName: "camera.fill")
                                    .font(.system(size: 36))
                                    .foregroundColor(.blue)
                                Text("Ajouter des photos")
                                    .font(.headline)
                                    .foregroundColor(.primary)
                                Text("Jusqu'à 10 photos")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 180)
                        }
                        .modifier(GlassCardModifier())
                    }
                    .padding(.horizontal, 16)
                    
                    // Formulaire
                    VStack(spacing: 16) {
                        FormField(label: "Titre de l'annonce", placeholder: "Ex: T-Shirt Nike noir taille M", text: $title)
                        FormField(label: "Prix (€)", placeholder: "Ex: 25,00", text: $price)
                        
                        // Catégorie
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Catégorie")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Picker("Catégorie", selection: $selectedCategory) {
                                ForEach(categories, id: \.self) { category in
                                    Text(category).tag(category)
                                }
                            }
                            .pickerStyle(.segmented)
                        }
                        
                        // État
                        VStack(alignment: .leading, spacing: 8) {
                            Text("État")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Picker("État", selection: $selectedCondition) {
                                ForEach(conditions, id: \.self) { condition in
                                    Text(condition).tag(condition)
                                }
                            }
                            .pickerStyle(.segmented)
                        }
                        
                        // Taille
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Taille")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Picker("Taille", selection: $selectedSize) {
                                ForEach(sizes, id: \.self) { size in
                                    Text(size).tag(size)
                                }
                            }
                            .pickerStyle(.segmented)
                        }
                        
                        // Description
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Description")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            TextEditor(text: $description)
                                .frame(height: 120)
                                .padding(8)
                                .background(Color(.systemBackground).opacity(0.5))
                                .cornerRadius(10)
                        }
                    }
                    .padding(16)
                    .modifier(GlassCardModifier())
                    .padding(.horizontal, 16)
                    
                    // Bouton Publier
                    Button(action: {
                        // Publier l'annonce
                    }) {
                        Text("Publier l'annonce")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                    }
                    .buttonStyle(.glassProminent)
                    .padding(.horizontal, 16)
                    
                    Spacer().frame(height: 100)
                }
            }
            
            SimpleGlassHeader(title: "Vendre")
        }
    }
}

struct FormField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.subheadline)
                .fontWeight(.medium)
            
            TextField(placeholder, text: $text)
                .padding(12)
                .background(Color(.systemBackground).opacity(0.5))
                .cornerRadius(10)
        }
    }
}

#Preview {
    SellView()
}
