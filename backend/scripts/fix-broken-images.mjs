import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuygjocnnlvjtoaquicq.supabase.co',
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '')
);

const FALLBACKS = {
  'Mode': 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=500&q=80',
  'Chaussures': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80',
  'Sacs': 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=500&q=80',
  'Montres': 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=500&q=80',
  'Téléphones': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80',
  'Ordinateurs': 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&q=80',
  'Audio': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
  'Tablettes': 'https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=500&q=80',
  'Gaming': 'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=500&q=80',
  'Drones': 'https://images.unsplash.com/photo-1507580461415-9b41870104ce?w=500&q=80',
  'Mobilier': 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=500&q=80',
  'Décoration': 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&q=80',
  'Bijoux': 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=80',
  'Parfums': 'https://images.unsplash.com/photo-1594035910387-fea47714263f?w=500&q=80',
  'Sport': 'https://images.unsplash.com/photo-1517836357463-d25dfe09ce1b?w=500&q=80',
  'Fitness': 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&q=80',
  'Beauté': 'https://images.unsplash.com/photo-1596462502278-27bf85033e5a?w=500&q=80',
  'Soins': 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=500&q=80',
  'Alimentation': 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=500&q=80',
  'Photo': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500&q=80',
  'default': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80'
};

async function checkImageValid(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: 'HEAD', timeout: 5000 });
    return res.ok;
  } catch (e) {
    try {
      // Sometimes HEAD is blocked, try GET
      const res = await fetch(url, { method: 'GET', timeout: 5000 });
      return res.ok;
    } catch(e2) {
      return false;
    }
  }
}

async function run() {
  console.log('Récupération des produits...');
  const { data: products, error } = await supabase.from('products').select('*');
  
  if (error) {
    console.error('Erreur:', error);
    return;
  }

  console.log(`${products.length} produits trouvés. Vérification des images...`);
  
  let fixedCount = 0;

  for (const p of products) {
    const isValid = await checkImageValid(p.image);
    if (!isValid) {
      console.log(`❌ Image cassée pour "${p.name}" (${p.image})`);
      
      const fallback = FALLBACKS[p.category] || FALLBACKS['default'];
      
      const { error: upErr } = await supabase
        .from('products')
        .update({ image: fallback })
        .eq('id', p.id);
        
      if (upErr) {
        console.error(`Erreur MAJ ${p.id}:`, upErr.message);
      } else {
        console.log(`✅ Image remplacée par fallback pour "${p.name}"`);
        fixedCount++;
      }
    }
  }

  console.log(`Terminé ! ${fixedCount} images cassées ont été corrigées.`);
}

run().catch(console.error);
