/**
 * Vercel Edge Middleware — Prerender.io Bot Detection
 *
 * Intercepts requests from search engine crawlers and social bots,
 * then fetches the pre-rendered HTML from Prerender.io so Google/Bing/etc.
 * can index the full product catalog instead of seeing an empty SPA shell.
 *
 * Compatible with Vite/static sites on Vercel (no Next.js dependency).
 * Real users are NOT affected — they get the normal JS app with zero overhead.
 */

export const config = {
    matcher: [
        '/((?!_vercel|api|assets|vendor|icons|Images|src|manifest\\.json|sw\\.js|favicon|robots\\.txt).*)',
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
 * @param {string} ua - User-Agent string
 * @returns {boolean}
 */
function isBot(ua) {
    const lower = ua.toLowerCase();
    return BOT_AGENTS.some((bot) => lower.includes(bot));
}

export default async function middleware(request) {
    const ua = request.headers.get('user-agent') || '';

    // Honour Prerender's own escape hatch to avoid infinite loops
    if (request.headers.get('x-prerender-bypass')) {
        return; // pass through
    }

    // Regular user — serve the normal SPA, no overhead
    if (!isBot(ua)) {
        return; // pass through
    }

    // ── Bot detected ──────────────────────────────────────────────────────────
    const PRERENDER_TOKEN = process.env.PRERENDER_TOKEN;

    if (!PRERENDER_TOKEN) {
        // Token not configured — fall back gracefully
        console.warn('[Prerender] PRERENDER_TOKEN env var is not set.');
        return; // pass through
    }

    const prerenderUrl = `https://service.prerender.io/${request.url}`;

    try {
        const prerendered = await fetch(prerenderUrl, {
            headers: {
                'X-Prerender-Token': PRERENDER_TOKEN,
                'User-Agent': ua,
            },
        });

        const html = await prerendered.text();

        return new Response(html, {
            status: prerendered.status,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
                'X-Prerendered': '1',
            },
        });
    } catch (err) {
        console.error('[Prerender] Fetch failed:', err);
        return; // fall back gracefully — bots get the SPA shell
    }
}
