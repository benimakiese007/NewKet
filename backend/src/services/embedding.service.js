import { pipeline, env } from '@xenova/transformers';

// Configuration optionnelle : permet de forcer le cache local et éviter de re-télécharger le modèle
// env.cacheDir = './.cache/transformers';

class EmbeddingService {
  constructor() {
    this.extractor = null;
    // CLIP ViT-B/32 : le standard de l'industrie pour la similarité Image/Texte (512 dimensions)
    this.modelName = 'Xenova/clip-vit-base-patch32'; 
    this.initPromise = this.init();
  }

  async init() {
    try {
      console.log(`[EmbeddingService] Chargement du modèle IA ${this.modelName}...`);
      // pipeline() va télécharger le modèle la première fois et le garder en cache
      this.extractor = await pipeline('image-feature-extraction', this.modelName);
      console.log(`[EmbeddingService] Modèle IA prêt !`);
    } catch (error) {
      console.error(`[EmbeddingService] Erreur d'initialisation :`, error);
    }
  }

  /**
   * Génère un vecteur (embedding) à partir de l'URL d'une image
   * @param {string} imageUrl URL publique de l'image
   * @returns {Promise<number[]>} Le vecteur à 512 dimensions
   */
  async generateImageEmbedding(imageUrl) {
    await this.initPromise;
    
    if (!this.extractor) {
      throw new Error("L'IA n'est pas initialisée");
    }

    try {
      // Génère l'embedding. L'IA s'occupe de télécharger l'image depuis l'URL, 
      // de la redimensionner, et de l'analyser.
      const output = await this.extractor(imageUrl);
      
      // Le résultat est un Float32Array. On le convertit en Array standard pour Supabase.
      return Array.from(output.data);
    } catch (error) {
      console.error(`[EmbeddingService] Erreur lors de l'analyse de l'image :`, error.message);
      return null;
    }
  }
}

export default new EmbeddingService();
