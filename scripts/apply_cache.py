import os
import re

def patch_api_client():
    path = r"C:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\services\api-client.js"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add import if missing
    if "import CacheManager from '../utils/CacheManager.js';" not in content:
        content = "import CacheManager from '../utils/CacheManager.js';\n" + content

    # Patch fetch method
    fetch_start = "async fetch(endpoint, options = {}) {"
    fetch_patched = """async fetch(endpoint, options = {}) {
        // --- OFFLINE CACHE INTERCEPTOR ---
        if (CacheManager && CacheManager.isOffline()) {
            const isGet = (options.method || 'GET').toUpperCase() === 'GET';
            if (isGet && options.cacheKey) {
                const offlineData = await CacheManager.getCache(options.cacheKey);
                if (offlineData) {
                    console.log(`[Offline] Servicing from CacheManager: ${options.cacheKey}`);
                    return offlineData;
                }
            } else if (!isGet) {
                return Promise.reject(new Error("Connexion internet requise pour cette action."));
            }
        }
        // ---------------------------------
"""
    content = content.replace(fetch_start, fetch_patched)

    # Patch _setCachedResponse to save to CacheManager
    set_cache_func = """    _setCachedResponse(cacheKey, data, ttlMs = 30000) {"""
    set_cache_patched = """    _setCachedResponse(cacheKey, data, ttlMs = 30000) {
        if (cacheKey && window.CacheManager && cacheKey.startsWith('cache_')) {
            window.CacheManager.setCache(cacheKey, data);
        }
"""
    content = content.replace(set_cache_func, set_cache_patched)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("api-client.js patched.")

def patch_supabase_adapter():
    path = r"C:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\services\supabase-adapter.js"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add import if missing
    if "import CacheManager from '../utils/CacheManager.js';" not in content:
        content = "import CacheManager from '../utils/CacheManager.js';\n" + content

    # Patch fetchWithFilters to handle offline
    fetch_filters_start = "async fetchWithFilters(table, options = {}) {"
    fetch_filters_patched = """async fetchWithFilters(table, options = {}) {
        if (window.CacheManager && window.CacheManager.isOffline()) {
            const offlineKey = table + ':' + JSON.stringify(options || {});
            const offlineData = await window.CacheManager.getCache(offlineKey);
            if (offlineData) {
                console.log(`[Offline] Loaded ${table} from IndexedDB`);
                return offlineData;
            }
        }
"""
    content = content.replace(fetch_filters_start, fetch_filters_patched)

    # Patch _setCache to persist to IndexedDB
    set_cache_start = """    _setCache(key, data, table) {"""
    set_cache_patched = """    _setCache(key, data, table) {
        const ttl = this._cacheTTL[table] || this._defaultTTL;
        this._cache[key] = { data, timestamp: Date.now(), ttl };
        
        if (window.CacheManager) {
            const offlineTables = ['products', 'categories', 'shops', 'orders', 'users', 'profiles'];
            if (offlineTables.includes(table) || key.includes('cache_')) {
                window.CacheManager.setCache(key, data);
            }
        }
"""
    # Replace only the first instance of setCache
    content = re.sub(r'    _setCache\(key, data, table\) \{[^}]*ttl \};', set_cache_patched, content, count=1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("supabase-adapter.js patched.")

patch_api_client()
patch_supabase_adapter()
