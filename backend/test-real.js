import embeddingService from './src/services/embedding.service.js';

async function test() {
  const url = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
  const vec = await embeddingService.generateImageEmbedding(url);
  console.log('Got vector of length:', vec ? vec.length : 'NULL');
}
test();
