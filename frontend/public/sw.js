const BUILD_VERSION = '__NEWKET_BUILD_VERSION__';
const CACHE_NAME = `newket-cache-${BUILD_VERSION}`;
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

    '/src/assets/css/style.css',
    '/src/assets/css/responsive.css',
    '/src/services/main.js',
    '/src/services/components-loader.js',
    '/manifest.json',
    '/Images/Logo NewKet PNG.png',
    '/Images/Logo NewKet PNG-192.png',
    '/favicon-16x16.png',
    '/favicon-32x32.png',
    '/favicon.ico'
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

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
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
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('push', (event) => {
    let payload = {
        title: 'NewKet',
        body: 'Vous avez une nouvelle notification.',
        icon: '/Images/Logo NewKet PNG-192.png',
        badge: '/favicon-32x32.png',
        data: { url: '/' }
    };

    try {
        if (event.data) {
            payload = { ...payload, ...event.data.json() };
        }
    } catch {
        payload.body = event.data ? event.data.text() : payload.body;
    }

    const { title, ...options } = payload;
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

    event.waitUntil((async () => {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
            if ('focus' in client && client.url.startsWith(self.location.origin)) {
                await client.focus();
                if ('navigate' in client) return client.navigate(targetUrl);
                return;
            }
        }

        if (self.clients.openWindow) {
            return self.clients.openWindow(targetUrl);
        }
    })());
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const method = event.request.method;

    // Fix: Disable SW intercept for localhost during development to avoid "ghost" version
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return;
    }

    // Never proxy third-party assets through the service worker.
    // This avoids CSP connect-src failures for Google Fonts, Google avatars,
    // Unsplash images, and similar external resources.
    if (url.origin !== self.location.origin) {
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
            fetch(event.request, { cache: 'no-store' }).then((networkResponse) => {
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
        // Network First keeps deployed UI changes fresh, while still falling back offline.
        event.respondWith(
            fetch(event.request, { cache: 'no-cache' }).then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    throw new Error('Offline asset unavailable');
                });
            })
        );
    } else {
        // Network First for same-origin app assets. API calls are excluded above.
        event.respondWith(
            fetch(event.request, { cache: 'no-cache' }).then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.ok) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                        }
                        return networkResponse;
                    });
                });
            })
        );
    }
});
