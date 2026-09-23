/**
 * Vercel Edge Middleware — Prerender.io Bot Detection
 *
 * Intercepts requests from search engine crawlers and social bots,
 * then fetches the pre-rendered HTML from Prerender.io so Google/Bing/etc.
 * can index the full product catalog instead of seeing an empty SPA shell.
 *
 * Real users are NOT affected — they get the normal JS app with zero overhead.
 */

export const config = {
    matcher: [
        // Pages that contain dynamic product content (worth indexing)
        '/',
        '/catalog',
        '/product',
        '/boutique/:path*',
        '/shop',
        '/shops',
        '/promo',
        '/about',
        '/faq',
        '/seller',
    ],
};

/** Known search engine and social media bot User-Agent patterns */
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

/**
 * Checks whether the incoming request comes from a known crawler/bot.
 * @param {Request} request
 * @returns {boolean}
 */
function isBot(request) {
    const ua = (request.headers.get('user-agent') || '').toLowerCase();
    // Honour Prerender's own escape hatch to avoid infinite loops
    if (request.headers.get('x-prerender-bypass')) return false;
    return BOT_AGENTS.some((bot) => ua.includes(bot));
}

export default async function middleware(request) {
    const { NextResponse } = await import('next/server').catch(() => ({
        NextResponse: {
            next: () => new Response(null, { status: 200 }),
            rewrite: (url) => Response.redirect(url),
        },
    }));

    if (!isBot(request)) {
        // Regular user — serve the normal SPA, no overhead
        return NextResponse.next();
    }

    // ── Bot detected ──────────────────────────────────────────────────────────
    const PRERENDER_TOKEN = process.env.PRERENDER_TOKEN;

    if (!PRERENDER_TOKEN) {
        // Token not configured — fall back to normal SPA (won't break the site)
        console.warn('[Prerender] PRERENDER_TOKEN env var is not set.');
        return NextResponse.next();
    }

    const requestUrl = new URL(request.url);
    // Build the Prerender.io service URL
    const prerenderUrl =
        `https://service.prerender.io/${requestUrl.href}`;

    try {
        const prerendered = await fetch(prerenderUrl, {
            headers: {
                'X-Prerender-Token': PRERENDER_TOKEN,
                // Pass original headers so Prerender can render accurately
                'User-Agent': request.headers.get('user-agent') || '',
            },
        });

        // Stream the pre-rendered HTML back to the bot
        const html = await prerendered.text();
        return new Response(html, {
            status: prerendered.status,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                // Tell CDNs not to cache this (Prerender has its own cache)
                'Cache-Control': 'no-store',
                'X-Prerendered': '1',
            },
        });
    } catch (err) {
        console.error('[Prerender] Fetch failed:', err);
        // On error, fall back gracefully — bots get the SPA shell
        return NextResponse.next();
    }
}
