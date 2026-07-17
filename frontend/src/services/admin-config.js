/**
 * NewKet Admin Configuration
 * Defines the fallback admin allowlist and a runtime loader for the persisted allowlist.
 * The database value in `settings.admin_emails` is the source of truth.
 */

const NEWKET_DEFAULT_ADMIN_EMAILS = [
    'benimakiese1234@gmail.com'
];

const normalizeAdminEmail = (value) => String(value || '').trim().toLowerCase();

const dedupeAdminEmails = (emails = []) => {
    return Array.from(
        new Set(
            emails
                .map(normalizeAdminEmail)
                .filter(Boolean)
        )
    );
};

window.ADMIN_EMAILS = dedupeAdminEmails(NEWKET_DEFAULT_ADMIN_EMAILS);

window.NewKetAdminEmails = window.NewKetAdminEmails || {
    _cache: {
        emails: window.ADMIN_EMAILS.slice(),
        fetchedAt: 0
    },
    _pending: null,

    getFallbackEmails() {
        return window.ADMIN_EMAILS.slice();
    },

    getCachedEmails() {
        return this._cache.emails.slice();
    },

    clearCache() {
        this._cache = {
            emails: this.getFallbackEmails(),
            fetchedAt: 0
        };
    },

    async refresh(force = false) {
        const now = Date.now();
        const cacheAge = now - (this._cache.fetchedAt || 0);
        const hasFreshCache = this._cache.emails.length > 0 && cacheAge < 5 * 60 * 1000;

        if (!force && hasFreshCache) {
            return this.getCachedEmails();
        }

        if (this._pending) {
            return this._pending;
        }

        if (!window.supabaseClient) {
            return this.getFallbackEmails();
        }

        this._pending = (async () => {
            try {
                let persistedEmails = [];

                try {
                    const response = await fetch('/api/settings', { credentials: 'same-origin' });
                    if (response.ok) {
                        const payload = await response.json();
                        const rows = Array.isArray(payload) ? payload : [payload].filter(Boolean);
                        const row = rows.find((item) => item && item.id === 'global-settings') || rows[0] || null;
                        persistedEmails = Array.isArray(row?.adminEmails)
                            ? row.adminEmails
                            : Array.isArray(row?.admin_emails)
                                ? row.admin_emails
                                : [];
                    }
                } catch (fetchError) {
                    // Ignore and fall back to Supabase direct access below.
                }

                if (persistedEmails.length === 0 && window.supabaseClient) {
                    const { data, error } = await window.supabaseClient
                        .from('settings')
                        .select('admin_emails')
                        .eq('id', 'global-settings')
                        .maybeSingle();

                    if (error) throw error;
                    persistedEmails = Array.isArray(data?.admin_emails) ? data.admin_emails : [];
                }

                const mergedEmails = dedupeAdminEmails([
                    ...NEWKET_DEFAULT_ADMIN_EMAILS,
                    ...persistedEmails
                ]);

                window.ADMIN_EMAILS = mergedEmails;
                this._cache = {
                    emails: mergedEmails,
                    fetchedAt: Date.now()
                };

                return this.getCachedEmails();
            } catch (error) {
                console.warn('[NewKet Admin Emails] Runtime whitelist refresh failed:', error?.message || error);
                const fallbackEmails = this.getFallbackEmails();
                this._cache = {
                    emails: fallbackEmails,
                    fetchedAt: Date.now()
                };
                return fallbackEmails;
            } finally {
                this._pending = null;
            }
        })();

        return this._pending;
    },

    async includes(email, force = false) {
        const normalized = normalizeAdminEmail(email);
        if (!normalized) return false;
        const emails = await this.refresh(force);
        return emails.includes(normalized);
    }
};

window.refreshNewKetAdminEmails = async (force = false) => {
    return window.NewKetAdminEmails.refresh(force);
};
