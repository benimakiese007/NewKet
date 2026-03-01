const CACHE_NAME = 'newket-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/catalog.html',
    '/product.html',
    '/cart.html',
    '/favorites.html',
    '/shops.html',
    '/shop.html',
    '/css/style.css',
    '/css/tailwind.css',
    '/js/main.js',
    '/js/supabase-client.js',
    '/js/supabase-adapter.js',
    '/manifest.json',
    '/Images/Logo NewKet V2.jpeg'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching all assets');
            return cache.addAll(ASSETS_TO_CACHE);
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

// Fetch Event (Stale-while-revalidate strategy)
self.addEventListener('fetch', (event) => {
    // Skip Supabase API calls or external resources if needed
    if (event.request.url.includes('supabase.co')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached response then update in background
                fetch(event.request).then((networkResponse) => {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                    });
                });
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            }).catch(() => {
                // Offline fallback for HTML pages
                if (event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
