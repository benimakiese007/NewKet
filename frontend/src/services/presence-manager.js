/**
 * NewKet Presence Manager
 * Tracks real-time active users using Supabase Presence.
 */
const PresenceManager = {
    channel: null,
    presences: {},
    _initialized: false,

    async init() {
        if (this._initialized) return;
        
        const client = window.SupabaseAdapter ? window.SupabaseAdapter.getClient() : null;
        if (!client) {
            console.warn('[PresenceManager] Supabase client not found.');
            return;
        }

        const user = window.AuthManager ? window.AuthManager.user : null;
        const role = window.AuthManager ? window.AuthManager.role : 'guest';
        const name = user ? (user.user_metadata?.full_name || user.email?.split('@')[0]) : 'Invité';

        // Use user ID if logged in, otherwise a random ID for guest
        const presenceKey = user ? user.id : `guest-${Math.random().toString(36).substr(2, 9)}`;

        this.channel = client.channel('global_presence', {
            config: {
                presence: {
                    key: presenceKey,
                },
            },
        });

        this.channel
            .on('presence', { event: 'sync' }, () => {
                this.presences = this.channel.presenceState();
                this._notify();
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                // Optional: log joins
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                // Optional: log leaves
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await this.channel.track({
                        user_id: user ? user.id : null,
                        name: name,
                        role: role,
                        page: window.location.pathname,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        this._initialized = true;
    },

    getActiveUsersCount() {
        // PresenceState can have multiple entries per key (e.g. multiple tabs)
        // We want to count unique keys
        return Object.keys(this.presences).length;
    },

    getActiveUsers() {
        const users = [];
        for (const key in this.presences) {
            const userPresences = this.presences[key];
            if (userPresences && userPresences.length > 0) {
                // Take the most recent/relevant entry for this user key
                users.push(userPresences[0]);
            }
        }
        return users;
    },

    _notify() {
        window.dispatchEvent(new CustomEvent('presenceUpdated', {
            detail: {
                count: this.getActiveUsersCount(),
                users: this.getActiveUsers()
            }
        }));
    }
};

window.PresenceManager = PresenceManager;
