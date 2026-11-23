import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

function buildManifest(settings = {}) {
  const themeColor = settings.theme_color || settings.themeColor || '#064734';
  const name = settings.shop_name || settings.shopName || 'NewKet — Marketplace Moderne';
  const shortName = 'NewKet';

  const icon192 = settings.pwa_icon_192_url || settings.pwaIcon192Url || '/icons/icon-192-v2.png';
  const icon512 = settings.pwa_icon_512_url || settings.pwaIcon512Url || '/icons/icon-512-v2.png';
  const icon192Mask = settings.pwa_icon_192_maskable_url || settings.pwaIcon192MaskableUrl || '/icons/icon-192-maskable-v2.png';
  const icon512Mask = settings.pwa_icon_512_maskable_url || settings.pwaIcon512MaskableUrl || '/icons/icon-512-maskable-v2.png';

  return {
    name,
    short_name: shortName,
    description: "L'excellence de la marketplace moderne. Découvrez une sélection rigoureuse d'articles de luxe.",
    start_url: '/index.html',
    display: 'standalone',
    background_color: themeColor,
    theme_color: themeColor,
    orientation: 'portrait',
    categories: ['shopping', 'lifestyle', 'luxury'],
    icons: [
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon192Mask, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: icon512Mask, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

router.get('/manifest', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'global-settings')
      .maybeSingle();

    if (error) {
      // Fall back to defaults when Supabase is in degraded mode or not configured.
      const payload = buildManifest();
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).send(JSON.stringify(payload));
    }

    const payload = buildManifest(data || {});
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).send(JSON.stringify(payload));
  } catch (err) {
    const payload = buildManifest();
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).send(JSON.stringify(payload));
  }
});

export default router;

