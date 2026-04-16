const CACHE_NAME = 'newket-cache-v5'; // Increment version
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/pages/catalog.html',
    '/pages/product.html',
    '/pages/cart.html',
    '/pages/favorites.html',
    '/pages/shops.html',
    '/pages/shop.html',
    '/assets/css/style.css',
    '/assets/css/responsive.css',
    '/services/main.js',
    '/services/supabase-client.js',
    '/services/supabase-adapter.js',
    '/services/auth.js',
    '/services/favorites.js',
    '/services/currency.js',
    '/services/products.js',
    '/services/orders.js',
    '/services/managers.js',
    '/services/ui-helpers.js',
    '/services/ui.js',
    '/services/search.js',
    '/services/components-loader.js',
    '/manifest.json',
    '/assets/Images/Logo NewKet V2.jpeg'
];

// Install Event
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching critical assets');
            // Use silent failure for non-critical assets to avoid install loop
            return Promise.allSettled(
                ASSETS_TO_CACHE.map(url => cache.add(url))
            );
        })
    );
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const method = event.request.method;

    // Fix: Disable SW intercept for localhost during development to avoid "ghost" version
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return;
    }

    // Skip: non-http, Supabase, Iconify, and all backend API calls
    if (
        !event.request.url.startsWith('http') ||
        url.hostname.includes('supabase.co') ||
        url.hostname.includes('iconify.design') ||
        url.port === '3001' ||
        url.pathname.startsWith('/api/')
    ) {
        return;
    }

    if (method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch((err) => {
                console.warn('[Service Worker] Fetch failed:', event.request.url, err);
                
                // Smart fallback: Only serve index.html if the request is actually for the login or root
                const acceptHeader = event.request.headers.get('accept') || '';
                if (acceptHeader.includes('text/html')) {
                    if (url.pathname === '/' || url.pathname.includes('index.html')) {
                        return caches.match('/index.html');
                    }
                }
                
                // Response with offline status instead of serving wrong page
                return new Response('Offline: Resource not found in cache.', { status: 503, statusText: 'Service Unavailable' });
            });

            return cachedResponse || fetchPromise;
        })
    );
});
