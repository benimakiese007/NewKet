/**
 * Supabase Adapter for NewKet — V2 (Optimized for scale)
 * Features: In-memory cache with TTL, automatic retry, pagination,
 * centralized filters, and cache invalidation on mutations.
 */
window.SupabaseAdapter = {
    // ========== CACHE SYSTEM ==========
    _cache: {},
    _cacheTTL: {
        products: 60000,      // 60s — products change infrequently
        users: 60000,         // 60s
        promos: 30000,        // 30s — promos can change more often
        orders: 15000,        // 15s — orders update frequently
        activities: 15000,    // 15s
        notifications: 10000, // 10s — real-time feel
        product_reviews: 20000 // 20s
    },
    _defaultTTL: 30000, // 30s fallback

    _getCacheKey(table, options) {
        return table + ':' + JSON.stringify(options || {});
    },

    _getFromCache(key) {
        const entry = this._cache[key];
        if (!entry) return null;
        if (Date.now() - entry.timestamp > entry.ttl) {
            delete this._cache[key];
            return null;
        }
        return entry.data;
    },

    _setCache(key, data, table) {
        const ttl = this._cacheTTL[table] || this._defaultTTL;
        this._cache[key] = { data, timestamp: Date.now(), ttl };
    },

    _invalidateTable(table) {
        const prefix = table + ':';
        Object.keys(this._cache).forEach(key => {
            if (key.startsWith(prefix)) {
                delete this._cache[key];
            }
        });
        console.log(`[NewKet Cache] Invalidated cache for "${table}"`);
    },

    // ========== CLIENT ==========
    getClient() {
        if (!window.supabaseClient) {
            console.error('Supabase client not initialized.');
            return null;
        }
        return window.supabaseClient;
    },

    // ========== RETRY LOGIC ==========
    async _retry(fn, maxAttempts = 3) {
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await fn();
                return result;
            } catch (err) {
                lastError = err;
                if (attempt < maxAttempts) {
                    const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
                    console.warn(`[NewKet] Retry ${attempt}/${maxAttempts} in ${delay}ms...`, err.message || err);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        throw lastError;
    },

    // ========== FETCH (simple, cached + retry) ==========
    async fetch(table, select = '*') {
        const cacheKey = this._getCacheKey(table, { select });
        const cached = this._getFromCache(cacheKey);
        if (cached) {
            console.log(`[NewKet Cache] HIT for "${table}"`);
            return cached;
        }

        const client = this.getClient();
        if (!client) return [];

        try {
            const data = await this._retry(async () => {
                const { data, error } = await client
                    .from(table)
                    .select(select);
                if (error) throw error;
                return data;
            });

            this._setCache(cacheKey, data, table);
            return data;
        } catch (err) {
            console.error(`[NewKet] Error fetching from ${table}:`, err);
            return [];
        }
    },

    // ========== FETCH WITH FILTERS (centralized, cached + retry) ==========
    /**
     * Fetch data with Supabase filters, caching, and retry.
     * @param {string} table - Table name
     * @param {object} options - Filter options
     * @param {string} [options.select='*'] - Columns to select
     * @param {Array}  [options.eq]        - Array of [column, value] pairs for .eq()
     * @param {Array}  [options.in]        - Array of [column, valuesArray] for .in()
     * @param {Array}  [options.order]     - [column, { ascending: bool }]
     * @param {number} [options.limit]     - Max rows to return
     * @param {boolean}[options.single]    - Use .single() for single row
     * @param {boolean}[options.skipCache] - Force bypass cache
     * @returns {Promise<Array|Object|null>}
     */
    async fetchWithFilters(table, options = {}) {
        const cacheKey = this._getCacheKey(table, options);

        if (!options.skipCache) {
            const cached = this._getFromCache(cacheKey);
            if (cached) {
                console.log(`[NewKet Cache] HIT for "${table}" (filtered)`);
                return cached;
            }
        }

        const client = this.getClient();
        if (!client) return options.single ? null : [];

        try {
            const data = await this._retry(async () => {
                let query = client.from(table).select(options.select || '*');

                // Apply .eq() filters
                if (options.eq) {
                    for (const [col, val] of options.eq) {
                        query = query.eq(col, val);
                    }
                }

                // Apply .in() filters
                if (options.in) {
                    for (const [col, vals] of options.in) {
                        query = query.in(col, vals);
                    }
                }

                // Apply .order()
                if (options.order) {
                    query = query.order(options.order[0], options.order[1] || {});
                }

                // Apply .limit()
                if (options.limit) {
                    query = query.limit(options.limit);
                }

                // Apply .single()
                if (options.single) {
                    query = query.single();
                }

                const { data, error } = await query;
                if (error) throw error;
                return data;
            });

            this._setCache(cacheKey, data, table);
            return data;
        } catch (err) {
            console.error(`[NewKet] Error fetching from ${table} (filtered):`, err);
            return options.single ? null : [];
        }
    },

    // ========== FETCH PAGINATED ==========
    /**
     * Fetch paginated data.
     * @param {string} table
     * @param {number} page - 1-indexed page number
     * @param {number} pageSize - Items per page (default 20)
     * @param {object} options - Same filter options as fetchWithFilters
     * @returns {Promise<{data: Array, count: number, page: number, pageSize: number}>}
     */
    async fetchPaginated(table, page = 1, pageSize = 20, options = {}) {
        const client = this.getClient();
        if (!client) return { data: [], count: 0, page, pageSize };

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        try {
            const result = await this._retry(async () => {
                let query = client
                    .from(table)
                    .select(options.select || '*', { count: 'exact' });

                if (options.eq) {
                    for (const [col, val] of options.eq) {
                        query = query.eq(col, val);
                    }
                }

                if (options.in) {
                    for (const [col, vals] of options.in) {
                        query = query.in(col, vals);
                    }
                }

                if (options.order) {
                    query = query.order(options.order[0], options.order[1] || {});
                }

                query = query.range(from, to);

                const { data, error, count } = await query;
                if (error) throw error;
                return { data, count };
            });

            return {
                data: result.data || [],
                count: result.count || 0,
                page,
                pageSize
            };
        } catch (err) {
            console.error(`[NewKet] Error paginated fetch from ${table}:`, err);
            return { data: [], count: 0, page, pageSize };
        }
    },

    // ========== MUTATIONS (with cache invalidation + retry) ==========
    async insert(table, item) {
        const client = this.getClient();
        if (!client) return null;

        try {
            const data = await this._retry(async () => {
                const { data, error } = await client
                    .from(table)
                    .insert(item)
                    .select();
                if (error) throw error;
                return data;
            });

            this._invalidateTable(table);
            return data && data.length > 0 ? data[0] : null;
        } catch (err) {
            console.error(`[NewKet] Error inserting into ${table}:`, err);
            return null;
        }
    },

    async update(table, id, updates, idColumn = 'id') {
        const client = this.getClient();
        if (!client) return null;

        try {
            const data = await this._retry(async () => {
                const { data, error } = await client
                    .from(table)
                    .update(updates)
                    .eq(idColumn, id)
                    .select();
                if (error) throw error;
                return data;
            });

            this._invalidateTable(table);
            return data && data.length > 0 ? data[0] : null;
        } catch (err) {
            console.error(`[NewKet] Error updating ${table}:`, err);
            return null;
        }
    },

    async delete(table, id, idColumn = 'id') {
        const client = this.getClient();
        if (!client) return false;

        try {
            await this._retry(async () => {
                const { error } = await client
                    .from(table)
                    .delete()
                    .eq(idColumn, id);
                if (error) throw error;
            });

            this._invalidateTable(table);
            return true;
        } catch (err) {
            console.error(`[NewKet] Error deleting from ${table}:`, err);
            return false;
        }
    },

    async upsert(table, item, onConflict = 'id') {
        const client = this.getClient();
        if (!client) return null;

        try {
            const data = await this._retry(async () => {
                const { data, error } = await client
                    .from(table)
                    .upsert(item, { onConflict })
                    .select();
                if (error) throw error;
                return data;
            });

            this._invalidateTable(table);
            return data && data.length > 0 ? data[0] : null;
        } catch (err) {
            console.error(`[NewKet] Error upserting into ${table}:`, err);
            return null;
        }
    },

    async uploadFile(bucket, filePath, file) {
        const client = this.getClient();
        if (!client) return null;

        try {
            return await this._retry(async () => {
                const { data, error } = await client.storage
                    .from(bucket)
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (error) throw error;

                const { data: publicUrlData } = client.storage
                    .from(bucket)
                    .getPublicUrl(filePath);

                return publicUrlData.publicUrl;
            });
        } catch (err) {
            console.error(`[NewKet] Error uploading file to ${bucket}:`, err);
            return null;
        }
    }
};
