import { HfInference } from '@huggingface/inference';

class EmbeddingService {
  constructor() {
    this.modelName = 'openai/clip-vit-base-patch32';
    // Initialise HF Inference
    const token = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;
    this.hf = new HfInference(token);
  }

  /**
   * Genere un vecteur (embedding) a partir de l'URL d'une image via HF API
   * @param {string} imageUrl URL publique de l'image
   * @returns {Promise<number[]>} Le vecteur a 512 dimensions
   */
  async generateImageEmbedding(imageUrl) {
    if (!process.env.HUGGINGFACE_TOKEN && !process.env.HF_TOKEN) {
      console.warn("[EmbeddingService] ATTENTION: HUGGINGFACE_TOKEN est manquant.");
    }

    try {
      // 1. Telecharger l'image car HF API prefere souvent un Blob binaire plutot qu'une URL
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        throw new Error("Impossible de telecharger l'image source");
      }
      const imageBlob = await imageRes.blob();

      // 2. Appel a l'API Serverless d'Hugging Face (hyper rapide)
      const output = await this.hf.featureExtraction({
        model: this.modelName,
        inputs: imageBlob,
      });

      // 3. Formater la reponse pour Supabase
      let vector = Array.isArray(output) ? output : Array.from(output);
      
      // Parfois CLIP retourne un tableau 2D (ex: [ [0.1, 0.2, ... 512] ])
      if (vector.length > 0 && Array.isArray(vector[0])) {
        vector = vector[0];
      }

      return vector;
    } catch (error) {
      console.error("[EmbeddingService] Erreur API HF:", error.message);
      return null;
    }
  }
}

export default new EmbeddingService();
