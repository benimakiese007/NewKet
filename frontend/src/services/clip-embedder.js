/**
 * clip-embedder.js
 * Génère un embedding CLIP 512-dim directement dans le navigateur.
 * Le modèle (~80MB) est téléchargé depuis HuggingFace une seule fois
 * puis mis en cache par le navigateur (Cache API / HTTP cache).
 */

let extractor = null;
let loadPromise = null;

/**
 * Charge le modèle CLIP (lazy load, une seule fois par session)
 * @returns {Promise<Function>} Le pipeline d'extraction de features
 */
async function loadModel(onProgress) {
  if (extractor) return extractor;

  if (!loadPromise) {
    loadPromise = (async () => {
      // Importation directe via CDN pour court-circuiter complètement le bundler de Vite
      // qui casse l'initialisation de WebAssembly (erreur registerBackend)
      const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
      
      const env = transformers.env;
      const pipeline = transformers.pipeline;

      env.allowLocalModels = false;

      // Force single-thread (pas de SharedArrayBuffer requis)
      if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = 1;
        env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';
      }

      if (onProgress) {
        onProgress({ status: 'loading', message: 'Chargement du modèle IA...' });
      }

      extractor = await pipeline(
        'image-feature-extraction',
        'Xenova/clip-vit-base-patch32',
        { quantized: true }
      );

      if (onProgress) {
        onProgress({ status: 'ready', message: 'Modèle IA prêt !' });
      }

      return extractor;
    })();
  }

  return loadPromise;
}


/**
 * Génère un vecteur CLIP 512-dim à partir d'un fichier image
 * @param {File|Blob} imageFile Le fichier image
 * @param {Function} onProgress Callback de progression optionnel
 * @returns {Promise<number[]>} Le vecteur 512 dimensions
 */
export async function generateEmbedding(imageFile, onProgress) {
  const model = await loadModel(onProgress);

  // Convertit le File en data URL pour @xenova
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });

  if (onProgress) {
    onProgress({ status: 'processing', message: 'Analyse de l\'image...' });
  }

  const output = await model(dataUrl);

  // Le output est un Tensor, on le convertit en Array standard
  let vector = Array.from(output.data);

  // Parfois CLIP retourne [[v1, v2, ...]] (tableau 2D), on prend le premier
  if (vector.length > 0 && Array.isArray(vector[0])) {
    vector = vector[0];
  }

  return vector;
}

/**
 * Précharge le modèle en arrière-plan (optionnel, pour améliorer l'UX)
 */
export function preloadModel() {
  loadModel().catch(() => {}); // Silencieux — juste du préchauffage
}
