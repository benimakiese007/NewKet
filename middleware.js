/**
 * Vercel Edge Middleware — Dynamic Open Graph Preview & Bot Detection
 *
 * 1. Intercepte les robots sociaux (WhatsApp, Facebook, Twitter, Telegram, LinkedIn)
 *    pour servir instantanément un aperçu enrichi (photo du produit, prix, nom de boutique)
 *    directement depuis Supabase en ~35ms.
 * 2. Si un compte Prerender.io est configuré et disponible, permet aux moteurs de recherche
 *    (Google/Bing) d'indexer le catalogue complet.
 * 3. Les visiteurs humains réels ont un overhead de 0 ms : ils reçoivent l'application normalement.
 */

export const config = {
    matcher: [
        '/((?!_vercel|api|assets|vendor|icons|Images|manifest\\.json|sw\\.js|favicon|robots\\.txt|.*\\.(?:css|js|png|jpg|jpeg|gif|webp|svg|woff2?|ico|json)$).*)',
    ],
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eWdqb2Nubmx2anRvYXF1aWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDM2NjYsImV4cCI6MjA4NjkxOTY2Nn0.1qyGb91CbLeSRNWKUNGiToJYGr8lsI-DeddWTnMv3SY';
const DEFAULT_OG_IMAGE = 'https://newket.vercel.app/Images/og-newket.png';

/** Robots des réseaux sociaux et moteurs de recherche */
const BOT_AGENTS = [
    'googlebot',
    'google-inspectiontool',
    'bingbot',
    'yandex',
    'baiduspider',
    'facebookexternalhit',
    'twitterbot',
    'whatsapp',
    'linkedinbot',
    'slackbot',
    'discordbot',
    'telegrambot',
    'applebot',
    'duckduckbot',
    'ia_archiver',
    'semrushbot',
    'ahrefsbot',
    'mj12bot',
    'rogerbot',
    'prerender',
];

function isBot(ua) {
    const lower = ua.toLowerCase();
    return BOT_AGENTS.some((bot) => lower.includes(bot));
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatPrice(amount, currency = 'CDF') {
    if (!amount && amount !== 0) return '';
    const num = Number(amount);
    if (isNaN(num)) return `${amount} ${currency}`;
    return `${num.toLocaleString('fr-FR')} ${currency}`;
}

/**
 * Analyse l'URL pour déterminer s'il s'agit d'un produit ou d'une boutique
 */
function parseUrlTarget(rawUrl) {
    try {
        const url = new URL(rawUrl, 'https://newket.vercel.app');
        const pathname = url.pathname || '';
        const searchId = url.searchParams.get('id');
        const searchShop = url.searchParams.get('shop');

        // Cas Produit
        if (searchId) return { type: 'product', id: searchId.trim() };
        const prodMatch = pathname.match(/\/boutique\/[^/]+\/produit\/([^/?#]+)/i);
        if (prodMatch) return { type: 'product', id: decodeURIComponent(prodMatch[1]).trim() };

        // Cas Boutique
        if (searchShop) return { type: 'shop', slug: searchShop.trim() };
        const shopMatch = pathname.match(/^\/boutique\/([^/?#]+)/i);
        if (shopMatch && !shopMatch[1].toLowerCase().includes('produit')) {
            const rawSlug = decodeURIComponent(shopMatch[1]).trim();
            const cleanSlug = rawSlug.replace(/_Shop_NewKet$/i, '').replace(/\/NewKet$/i, '');
            if (cleanSlug) return { type: 'shop', slug: cleanSlug };
        }

        // Cas Parrainage : /signup/:code
        const signupMatch = pathname.match(/^\/signup\/([^/?#]+)/i);
        if (signupMatch) return { type: 'referral', code: decodeURIComponent(signupMatch[1]).trim() };
    } catch (_) {}
    return null;
}

/**
 * Récupère les données d'un produit depuis Supabase REST
 */
async function fetchProductData(productId) {
    try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);
        const filter = isUuid
            ? `id=eq.${encodeURIComponent(productId)}`
            : `name=ilike.*${encodeURIComponent(productId.replace(/[-_]/g, ' ')) }*`;

        const queryUrl = `${SUPABASE_URL}/rest/v1/products?${filter}&is_archived=neq.true&select=id,name,price,old_price,is_promo,image,images,description,supplier_email&limit=1`;
        const res = await fetch(queryUrl, {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
        });
        if (!res.ok) return null;
        const list = await res.json();
        return Array.isArray(list) && list[0] ? list[0] : null;
    } catch (e) {
        console.warn('[OG-Product] Supabase fetch error:', e);
        return null;
    }
}

/**
 * Récupère un utilisateur par son code de parrainage depuis Supabase REST
 */
async function fetchReferralUser(code) {
    try {
        const url = `${SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(code)}&select=name,company_name,avatar&limit=1`;
        const res = await fetch(url, {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
        });
        if (!res.ok) return null;
        const list = await res.json();
        return Array.isArray(list) && list[0] ? list[0] : null;
    } catch (e) {
        console.warn('[OG-Referral] Supabase fetch error:', e);
        return null;
    }
}

/**
 * Récupère les données d'une boutique depuis Supabase REST
 */
async function fetchShopData(shopSlug) {
    try {
        const clean = shopSlug.trim();
        // 1. Recherche exacte par shop_slug
        const exactUrl = `${SUPABASE_URL}/rest/v1/users?role=eq.supplier&shop_slug=eq.${encodeURIComponent(clean)}&select=name,company_name,avatar,cover_image,store_description,seller_type&limit=1`;
        const resExact = await fetch(exactUrl, {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
        });
        if (resExact.ok) {
            const listExact = await resExact.json();
            if (Array.isArray(listExact) && listExact[0]) return listExact[0];
        }

        // 2. Recherche tolérante par nom d'entreprise ou nom de vendeur
        const safeName = clean.replace(/[-_]/g, ' ');
        const fuzzyUrl = `${SUPABASE_URL}/rest/v1/users?role=eq.supplier&company_name=ilike.*${encodeURIComponent(safeName)}*&select=name,company_name,avatar,cover_image,store_description,seller_type&limit=1`;
        const resFuzzy = await fetch(fuzzyUrl, {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
        });
        if (resFuzzy.ok) {
            const listFuzzy = await resFuzzy.json();
            if (Array.isArray(listFuzzy) && listFuzzy[0]) return listFuzzy[0];
        }
        return null;
    } catch (e) {
        console.warn('[OG-Shop] Supabase fetch error:', e);
        return null;
    }
}

/**
 * Génère la page HTML minimale avec toutes les balises Open Graph enrichies
 */
function renderOpenGraphResponse({ title, description, imageUrl, canonicalUrl, price = null, type = 'website' }) {
    const safeTitle = escapeHtml(title);
    const safeDesc = escapeHtml(description);
    const safeImg = escapeHtml(imageUrl || DEFAULT_OG_IMAGE);
    const safeUrl = escapeHtml(canonicalUrl);

    const priceTags = price != null ? `
    <meta property="product:price:amount" content="${escapeHtml(String(price))}">
    <meta property="product:price:currency" content="CDF">` : '';

    const html = `<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}">

    <!-- Open Graph / WhatsApp / Facebook -->
    <meta property="og:type" content="${escapeHtml(type)}">
    <meta property="og:site_name" content="NewKet">
    <meta property="og:locale" content="fr_CD">
    <meta property="og:url" content="${safeUrl}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDesc}">
    <meta property="og:image" content="${safeImg}">
    <meta property="og:image:secure_url" content="${safeImg}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${safeTitle}">${priceTags}

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDesc}">
    <meta name="twitter:image" content="${safeImg}">

    <!-- Redirection automatique si un utilisateur charge cette URL -->
    <meta http-equiv="refresh" content="0;url=${safeUrl}">
</head>
<body>
    <p>Redirection vers <a href="${safeUrl}">${safeTitle}</a> sur NewKet...</p>
</body>
</html>`;

    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-NewKet-Preview': type,
        },
    });
}

export default async function middleware(request) {
    const ua = request.headers.get('user-agent') || '';

    // Échappatoire pour éviter les boucles infinies de scraping
    if (request.headers.get('x-prerender-bypass')) {
        return;
    }

    // Utilisateur humain standard : zéro latence, pass-through immédiat
    if (!isBot(ua)) {
        return;
    }

    // ── GESTION DYNAMIQUE PRODUITS & BOUTIQUES POUR LES ROBOTS ────────────────
    const target = parseUrlTarget(request.url);

    if (target?.type === 'product' && target.id) {
        const product = await fetchProductData(target.id);
        if (product) {
            const isPromo = product.is_promo === true;
            const priceFormatted = formatPrice(product.price);
            const oldPriceFormatted = isPromo && product.old_price ? formatPrice(product.old_price) : null;
            const title = isPromo && oldPriceFormatted
                ? `🔥 PROMO : ${product.name} — ${priceFormatted} (au lieu de ${oldPriceFormatted}) | NewKet`
                : `${product.name} — ${priceFormatted} | NewKet`;
            const description = product.description
                ? product.description.slice(0, 180)
                : `Achetez ${product.name} sur NewKet, la marketplace N°1 à Kinshasa & en RDC. Paiement Mobile Money sécurisé, livraison rapide.`;
            const image = product.image
                || (Array.isArray(product.images) && product.images[0])
                || DEFAULT_OG_IMAGE;
            const canonicalUrl = `https://newket.vercel.app/src/pages/product.html?id=${encodeURIComponent(product.id)}`;

            return renderOpenGraphResponse({
                title,
                description,
                imageUrl: image,
                canonicalUrl,
                price: product.price,
                type: 'product',
            });
        }
    }

    if (target?.type === 'shop' && target.slug) {
        const vendor = await fetchShopData(target.slug);
        if (vendor) {
            const shopName = vendor.company_name || vendor.name || target.slug;
            const certifiedBadge = vendor.seller_type === 'certified' ? ' (Vendeur Certifié)' : '';
            const title = `Boutique ${shopName}${certifiedBadge} • NewKet Kinshasa`;
            const description = vendor.store_description
                ? vendor.store_description.slice(0, 180)
                : `Découvrez tous les articles de la boutique ${shopName} sur NewKet. Produits authentiques, paiement Mobile Money, livraison à Kinshasa.`;
            // Ordre de priorité convenu : Bannière de couverture -> Logo/Avatar -> Bannière NewKet
            const image = vendor.cover_image || vendor.avatar || DEFAULT_OG_IMAGE;
            const canonicalUrl = `https://newket.vercel.app/src/pages/shop.html?shop=${encodeURIComponent(target.slug)}`;

            return renderOpenGraphResponse({
                title,
                description,
                imageUrl: image,
                canonicalUrl,
                type: 'website',
            });
        }
    }

    if (target?.type === 'referral' && target.code) {
        const referee = await fetchReferralUser(target.code);
        const inviterName = referee ? (referee.company_name || referee.name || 'un membre NewKet') : 'un membre NewKet';
        return renderOpenGraphResponse({
            title: `Rejoins NewKet et profite avec le code ${target.code} ! 🎁`,
            description: `${inviterName} t'invite sur NewKet, la marketplace N°1 à Kinshasa. Paiement Mobile Money sécurisé, livraison rapide en RDC.`,
            imageUrl: referee?.avatar || DEFAULT_OG_IMAGE,
            canonicalUrl: `https://newket.vercel.app/src/pages/login?signup=1&ref=${encodeURIComponent(target.code)}`,
            type: 'website',
        });
    }

    // ── FALLBACK PRERENDER.IO POUR LES AUTRES PAGES (INDEX, CATALOGUE...) ─────
    const PRERENDER_TOKEN = process.env.PRERENDER_TOKEN;
    if (!PRERENDER_TOKEN) {
        return; // pass-through vers la page HTML avec les balises statiques NewKet
    }

    const prerenderUrl = `https://service.prerender.io/${request.url}`;

    try {
        const prerendered = await fetch(prerenderUrl, {
            headers: {
                'X-Prerender-Token': PRERENDER_TOKEN,
                'User-Agent': ua,
            },
        });

        // En cas d'erreur Prerender.io (quota, 503...), on passe gracieusement au HTML normal
        if (!prerendered.ok) {
            return;
        }

        const html = await prerendered.text();

        return new Response(html, {
            status: prerendered.status,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
                'X-Prerendered': '1',
            },
        });
    } catch (_) {
        return;
    }
}
