import { HfInference } from '@huggingface/inference';

async function test() {
  const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);
  const url = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
  const imageRes = await fetch(url);
  const imageBlob = await imageRes.blob();
  
  try {
    const output = await hf.featureExtraction({
      model: 'sentence-transformers/clip-ViT-B-32',
      inputs: imageBlob,
    });
    console.log('Success! Dimensions:', Array.isArray(output) ? output.length : output);
  } catch(e) {
    console.error('Error:', e.message);
  }
}
test();
