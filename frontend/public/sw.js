const CACHE_NAME = 'newket-cache-v10'; // Increment version
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/src/pages/catalog.html',
    '/src/pages/product.html',
    '/src/pages/favorites.html',
    '/src/pages/shops.html',
    '/src/pages/shop.html',
    '/src/pages/support.html',
    '/src/pages/faq.html',
    '/src/pages/forum.html',
    '/src/assets/css/style.css',
    '/src/assets/css/responsive.css',
    '/src/services/main.js',
    '/src/services/components-loader.js',
    '/manifest.json',
    '/Images/Logo NewKet PNG.png',
    '/Images/Logo NewKet PNG-192.png',
    '/favicon-16x16.png',
    '/favicon-32x32.png',
    '/favicon.ico',
    '/Images/Logo_Header_Officiel_PNG.png',
    '/Images/Logo_NewKet_Pour_Les_HEADERs_Only.png',
    '/Images/Logo_Vert_Pour_Fond_Blanc.png'
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

    const isHTML = event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html');
    const isImageOrStatic = url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff2?)$/i);

    if (isHTML) {
        // Network First (fallback to cache) for HTML pages
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(event.request).then(response => {
                    if (response) return response;
                    // Smart fallback
                    if (url.pathname === '/' || url.pathname.includes('index.html')) {
                        return caches.match('/index.html');
                    }
                    return new Response('Offline: Page unavailable.', { status: 503, statusText: 'Service Unavailable' });
                });
            })
        );
    } else if (isImageOrStatic) {
        // Stale-While-Revalidate for images, CSS, JS
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }
                    return networkResponse;
                }).catch(err => {
                    console.warn('[Service Worker] background fetch failed', err);
                });
                
                return cachedResponse || fetchPromise; // Return cached immediately, fetch updates in background
            })
        );
    } else {
        // Cache First for other assets
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }
                    return networkResponse;
                });
            })
        );
    }
});
