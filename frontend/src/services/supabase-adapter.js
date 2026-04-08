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
        const now = Date.now();
        Object.keys(this._cache).forEach(key => {
            const entry = this._cache[key];
            // Nettoyage de la cible OU Garbage Collection passif des clés périmées globales
            if (key.startsWith(prefix) || (now - entry.timestamp > entry.ttl)) {
                delete this._cache[key];
            }
        });
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

                // --- CUSTOM JWT EXPIRED INTERCEPTOR ---
                const errMsg = (err.message || '').toLowerCase();
                const errDetails = (err.details || '').toLowerCase();
                if (errMsg.includes('jwt expired') || errDetails.includes('jwt expired') || err.status === 401) {
                    console.warn(`[NewKet] Auth Warning: JWT expired or 401 (Attempt ${attempt}). Allowing SDK refresh...`);
                    
                    if (attempt >= maxAttempts) {
                        console.error('[NewKet] Fatal Auth Error: Token could not be refreshed. Forcing logout.');
                        if (window.AuthManager && typeof window.AuthManager.logout === 'function') {
                            window.AuthManager.logout();
                        } else {
                            localStorage.removeItem('newketRole');
                            localStorage.removeItem('newketUserEmail');
                            if (window.supabaseClient) window.supabaseClient.auth.signOut().then(() => window.location.reload());
                            else window.location.reload();
                        }
                        throw new Error('Session expirée définitivement. Veuillez vous reconnecter.');
                    }
                }
                // --------------------------------------

                if (attempt < maxAttempts) {
                    const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
                    console.warn(`[NewKet] Retry ${attempt}/${maxAttempts} in ${delay}ms...`, err.message || err);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        throw lastError;
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

                // Apply .ilike() filters (text search)
                if (options.ilike) {
                    for (const [col, pattern] of options.ilike) {
                        query = query.ilike(col, pattern);
                    }
                }

                // Apply .or() filters (supports single string or array of strings)
                if (options.or) {
                    if (Array.isArray(options.or)) {
                        for (const orCond of options.or) {
                            query = query.or(orCond);
                        }
                    } else {
                        query = query.or(options.or);
                    }
                }

                // Apply .gte() filters (greater than or equal)
                if (options.gte) {
                    for (const [col, val] of options.gte) {
                        query = query.gte(col, val);
                    }
                }

                // Apply .lte() filters (less than or equal)
                if (options.lte) {
                    for (const [col, val] of options.lte) {
                        query = query.lte(col, val);
                    }
                }

                // Apply .order()
                if (options.order) {
                    query = query.order(options.order[0], options.order[1] || {});
                }

                // Apply .range() for pagination (from, to inclusive)
                if (options.range) {
                    query = query.range(options.range[0], options.range[1]);
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

    /**
     * Subscribe to real-time changes on a table.
     * @param {string} table - Table name
     * @param {string} event - 'INSERT', 'UPDATE', 'DELETE', or '*'
     * @param {function} callback - Callback function receiving the payload
     */
    subscribeToTable(table, event, callback) {
        const client = this.getClient();
        if (!client) return null;

        return client.channel(`public:${table}:${event}`)
            .on('postgres_changes', { event, schema: 'public', table }, payload => {
                callback(payload);
            })
            .subscribe();
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
    },

    // ========== MUTATIONS (with cache invalidation) ==========
    async insert(table, data) {
        const client = this.getClient();
        if (!client) return null;

        try {
            const result = await this._retry(async () => {
                const { data: inserted, error } = await client.from(table).insert(data).select().single();
                if (error) throw error;
                return inserted;
            });
            this._invalidateTable(table);
            return result;
        } catch (err) {
            console.error(`[NewKet] Error inserting into ${table}:`, err);
            return null;
        }
    },

    async update(table, id, data) {
        const client = this.getClient();
        if (!client) return false;

        try {
            await this._retry(async () => {
                const { error } = await client.from(table).update(data).eq('id', id);
                if (error) throw error;
            });
            this._invalidateTable(table);
            return true;
        } catch (err) {
            console.error(`[NewKet] Error updating ${table} (id: ${id}):`, err);
            return false;
        }
    },

    async delete(table, id) {
        const client = this.getClient();
        if (!client) return false;

        try {
            await this._retry(async () => {
                const { error } = await client.from(table).delete().eq('id', id);
                if (error) throw error;
            });
            this._invalidateTable(table);
            return true;
        } catch (err) {
            console.error(`[NewKet] Error deleting from ${table} (id: ${id}):`, err);
            return false;
        }
    },

    async upsert(table, data) {
        const client = this.getClient();
        if (!client) return null;

        try {
            const result = await this._retry(async () => {
                const { data: upserted, error } = await client.from(table).upsert(data).select().single();
                if (error) throw error;
                return upserted;
            });
            this._invalidateTable(table);
            return result;
        } catch (err) {
            console.error(`[NewKet] Error upserting into ${table}:`, err);
            return null;
        }
    }
};
