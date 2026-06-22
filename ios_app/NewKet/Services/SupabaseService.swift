import Foundation
// Import du SDK Supabase : `import Supabase` (Nécessite le Swift Package 'supabase-swift')

/// Service central gérant la connexion à la base de données Supabase.
///
/// **Note pour le développement :**
/// Pour compiler ce code sur Xcode, vous devez ajouter le package :
/// `https://github.com/supabase-community/supabase-swift.git`
/// via File -> Add Packages.
class SupabaseService {
    static let shared = SupabaseService()
    
    // Clés extraites de votre fichier frontend/.env
    private let supabaseURL = URL(string: "https://kuygjocnnlvjtoaquicq.supabase.co")!
    private let supabaseKey = "sb_publishable_iMlPI6QIA0U0qqRfLp5_WA_-443VkDx"
    
    // Décommenter une fois le SDK installé dans Xcode :
    // let client: SupabaseClient
    
    private init() {
        // Décommenter une fois le SDK installé dans Xcode :
        // self.client = SupabaseClient(supabaseURL: supabaseURL, supabaseKey: supabaseKey)
    }
}
