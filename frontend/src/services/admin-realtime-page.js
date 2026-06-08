const state = {
    ready: false,
    paused: false,
    feedWindowMinutes: 60,
    feedFilter: 'all',
    feedSearch: '',
    currentDays: 7,
    currentRealtimeDateRange: { start: null, end: null },
    events: [],
    dedupe: new Map(),
    realtimeChannels: [],
    realtimeProfileCache: new Map(),
    snapshotCounts: {
        presence: 0,
        orders: 0,
        products: 0,
        notifications: 0,
        activities: 0,
        analytics: 0,
        incidents: 0,
    },
    lastEvent: null,
    lastRenderedVisibleCount: 0,
    latestIncident: null,
};

const TYPE_META = {
    presence: { label: 'Presence', icon: 'solar:users-group-two-rounded-bold-duotone', badge: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
    order: { label: 'Commande', icon: 'solar:bag-bold-duotone', badge: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
    product: { label: 'Produit', icon: 'solar:shop-bold-duotone', badge: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
    notification: { label: 'Notification', icon: 'solar:bell-bold-duotone', badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    activity: { label: 'Activite', icon: 'solar:clipboard-list-bold-duotone', badge: 'bg-slate-50 text-slate-700', dot: 'bg-slate-500' },
    traffic: { label: 'Trafic', icon: 'solar:graph-up-bold-duotone', badge: 'bg-cyan-50 text-cyan-700', dot: 'bg-cyan-500' },
    incident: { label: 'Incident', icon: 'solar:danger-bold-duotone', badge: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
    system: { label: 'Systeme', icon: 'solar:settings-bold-duotone', badge: 'bg-gray-100 text-gray-700', dot: 'bg-gray-500' },
};

function $id(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatCount(value) {
    return Number(value || 0).toLocaleString('fr-FR');
}

function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 o';
    const units = ['o', 'Ko', 'Mo', 'Go'];
    const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const scaled = bytes / (1024 ** idx);
    return `${scaled >= 10 || idx === 0 ? Math.round(scaled) : scaled.toFixed(1)} ${units[idx]}`;
}

function formatDurationMs(value) {
    const ms = Number(value || 0);
    if (!Number.isFinite(ms) || ms <= 0) return '0 ms';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
    const minutes = seconds / 60;
    if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`;
    const hours = minutes / 60;
    return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
}

function csvEscape(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function buildFeedCsv(events) {
    const rows = [
        ['timestamp', 'type', 'source', 'title', 'detail', 'actor', 'severity', 'meta'].map(csvEscape).join(','),
    ];
    events.forEach((event) => {
        rows.push([
            event.timestamp || '',
            event.type || '',
            event.source || '',
            event.title || '',
            event.detail || '',
            event.actor || '',
            event.severity || '',
            JSON.stringify(event.meta || {}),
        ].map(csvEscape).join(','));
    });
    return rows.join('\r\n');
}

function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatClock(ts) {
    try {
        return new Date(ts).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return '--:--:--';
    }
}

function formatRelative(ts) {
    const diffMs = Date.now() - new Date(ts).getTime();
    const seconds = Math.max(0, Math.floor(diffMs / 1000));
    if (seconds < 5) return 'a l instant';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
}

function getLocalTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    } catch {
        return 'local';
    }
}

function getClient() {
    return window.SupabaseAdapter?.getClient?.() || window.supabaseClient || null;
}

function getUserDisplayName(user) {
    if (!user) return 'Utilisateur inconnu';
    if (window.UserManager?.getDisplayName) return window.UserManager.getDisplayName(user);
    const fallback = user.email ? user.email.split('@')[0] : 'Inconnu';
    return user.company_name || user.store_name || user.shop_name || user.full_name || user.name || fallback;
}

function getUserAvatar(user) {
    return user?.avatar ||
        user?.avatar_url ||
        user?.picture ||
        user?.photo_url ||
        user?.picture_url ||
        user?.cover_image ||
        user?.user_metadata?.avatar_url ||
        user?.user_metadata?.picture ||
        '';
}

function isAdminPresence(user) {
    if (!user) return false;

    const role = String(
        user.role ||
        user.user_role ||
        user.user_metadata?.role ||
        ''
    ).toLowerCase();

    if (role === 'admin') return true;

    const activeAdminId = window.AuthManager?.role === 'admin'
        ? (window.AuthManager?.user?.id || window.AuthManager?.user?.user_id || '')
        : '';
    const presenceUserId = user.user_id || user.id || '';

    return !!activeAdminId && !!presenceUserId && String(activeAdminId) === String(presenceUserId);
}

function filterOutAdminPresence(users) {
    return (Array.isArray(users) ? users : []).filter((user) => !isAdminPresence(user));
}

function renderUserAvatar(user, fallbackName, className = 'w-8 h-8') {
    const avatarUrl = getUserAvatar(user);
    const label = (fallbackName || getUserDisplayName(user) || '?').trim();
    const initial = (label.charAt(0) || '?').toUpperCase();

    if (avatarUrl) {
        return `
            <img
                loading="lazy"
                src="${escapeHtml(avatarUrl)}"
                class="${className} rounded-full object-cover border border-gray-100 flex-shrink-0"
                onerror="this.outerHTML='<div class=&quot;${className} rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-black flex-shrink-0&quot;>${initial}</div>';"
            >
        `;
    }

    return `<div class="${className} rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-black flex-shrink-0">${initial}</div>`;
}

function showUserIdentity(user) {
    const name = getUserDisplayName(user);
    const email = user.email || user.email_address || user.email || user.email_url || 'N/A';
    const role = user.role || 'N/A';
    alert(`Identité de l'utilisateur:\nNom: ${name}\nEmail: ${email}\nRôle: ${role}`);
}

function isLeadInRealtimeRange(lead, range = state.currentRealtimeDateRange) {
    if (!range || (!range.start && !range.end)) return true;
    const timestamp = new Date(lead?.date || lead?.created_at || 0).getTime();
    if (!timestamp) return false;
    if (range.start) {
        const startTime = new Date(`${range.start}T00:00:00`).getTime();
        if (!Number.isNaN(startTime) && timestamp < startTime) return false;
    }
    if (range.end) {
        const endTime = new Date(`${range.end}T23:59:59.999`).getTime();
        if (!Number.isNaN(endTime) && timestamp > endTime) return false;
    }
    return true;
}

function withinFeedWindow(ts) {
    if (!state.feedWindowMinutes) return true;
    const ageMs = Date.now() - new Date(ts).getTime();
    return ageMs >= 0 && ageMs <= state.feedWindowMinutes * 60 * 1000;
}

function eventMatchesFilter(event) {
    if (state.feedFilter !== 'all' && event.type !== state.feedFilter) return false;
    if (!state.feedSearch) return true;
    const haystack = [
        event.title,
        event.detail,
        event.source,
        event.actor,
        event.meta?.label,
        event.meta?.id,
        event.meta?.status,
        event.meta?.page,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(state.feedSearch.toLowerCase());
}

function setActiveButtonGroup(selector, attribute, currentValue) {
    document.querySelectorAll(selector).forEach((btn) => {
        const active = String(btn.dataset[attribute] || '') === String(currentValue);
        btn.classList.toggle('bg-black', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('bg-white', !active);
        btn.classList.toggle('text-gray-500', !active);
        btn.classList.toggle('border', !active);
        btn.classList.toggle('border-gray-200', !active);
    });
}

function setLiveWindowLabel() {
    const label = $id('liveWindowLabel');
    if (!label) return;
    label.textContent = state.feedWindowMinutes
        ? `Fenetre: ${state.feedWindowMinutes === 1440 ? '24h' : `${state.feedWindowMinutes}m`}`
        : 'Fenetre: tout';
}

function setStatusPill(text, variant = 'neutral') {
    const pill = $id('realtimeStatusPill');
    if (!pill) return;
    pill.textContent = text;
    pill.className = 'rounded-full border px-2.5 py-1 font-black uppercase tracking-widest';
    if (variant === 'good') {
        pill.classList.add('border-emerald-200', 'bg-emerald-50', 'text-emerald-700');
    } else if (variant === 'warn') {
        pill.classList.add('border-amber-200', 'bg-amber-50', 'text-amber-700');
    } else if (variant === 'danger') {
        pill.classList.add('border-red-200', 'bg-red-50', 'text-red-700');
    } else {
        pill.classList.add('border-gray-200', 'bg-white', 'text-gray-500');
    }
}

function updateLiveCaption() {
    const caption = $id('liveStatusCaption');
    if (!caption) return;
    const filterLabel = state.feedFilter === 'all' ? 'tout' : state.feedFilter;
    const pausedText = state.paused ? 'La timeline est en pause.' : 'Les mises a jour arrivent en direct.';
    caption.textContent = `${pausedText} Filtre actif: ${filterLabel}.`;
}

function updateMetrics() {
    const activeUsers = filterOutAdminPresence(window.PresenceManager?.getActiveUsers?.() || []).length;
    const visibleEvents = getVisibleFeedCount();
    const lastEvent = state.lastEvent;
    const channels = state.realtimeChannels.length + (window.PresenceManager?.channel ? 1 : 0);
    const activeIncidents = state.events.filter((event) => event.type === 'incident' && !event.meta?.resolved);
    const incidentCount = activeIncidents.length;
    const latestIncident = activeIncidents[0] || null;

    const activeUsersEl = $id('metricActiveUsers');
    if (activeUsersEl) activeUsersEl.textContent = formatCount(activeUsers);

    const visibleEventsEl = $id('metricVisibleEvents');
    if (visibleEventsEl) visibleEventsEl.textContent = formatCount(visibleEvents);

    const lastEventEl = $id('metricLastEvent');
    if (lastEventEl) lastEventEl.textContent = lastEvent ? lastEvent.title : '-';

    const lastEventAtEl = $id('metricLastEventAt');
    if (lastEventAtEl) lastEventAtEl.textContent = lastEvent ? `${formatClock(lastEvent.timestamp)}  |  ${formatRelative(lastEvent.timestamp)}` : 'En attente';

    const channelCountEl = $id('metricChannelCount');
    if (channelCountEl) channelCountEl.textContent = formatCount(channels);

    const incidentCountEl = $id('metricIncidentCount');
    if (incidentCountEl) incidentCountEl.textContent = formatCount(incidentCount);

    const feedMeta = $id('liveFeedMeta');
    if (feedMeta) feedMeta.textContent = `${formatCount(visibleEvents)} evenement${visibleEvents > 1 ? 's' : ''}`;

    const activeUsersLine = $id('presenceCountLine');
    if (activeUsersLine) activeUsersLine.textContent = `${formatCount(activeUsers)} en ligne (admin exclu)`;

    const banner = $id('incidentBanner');
    const bannerTitle = $id('incidentBannerTitle');
    const bannerDetail = $id('incidentBannerDetail');
    if (banner && bannerTitle && bannerDetail) {
        if (latestIncident) {
            banner.hidden = false;
            bannerTitle.textContent = latestIncident.title || 'Incident en cours';
            bannerDetail.textContent = latestIncident.detail || 'Incident detecte dans les signaux du tableau de bord.';
        } else {
            banner.hidden = true;
            bannerTitle.textContent = 'Incident en cours';
            bannerDetail.textContent = 'Aucun incident actif pour le moment.';
        }
    }

    setStatusPill(state.paused ? 'Pause' : (state.realtimeChannels.some((entry) => entry.status === 'SUBSCRIBED') ? 'Live' : 'Connecte'), state.paused ? 'warn' : 'good');
    updateLiveCaption();
    return visibleEvents;
}

function updateChannelHealth() {
    const list = $id('channelHealthList');
    if (!list) return;

    const activeUsers = filterOutAdminPresence(window.PresenceManager?.getActiveUsers?.() || []).length;
    const channels = [
        {
            name: 'Client Supabase',
            status: getClient() ? 'READY' : 'MISSING',
            detail: getClient() ? 'Client disponible pour le monitoring live.' : 'Client non disponible.',
            value: state.realtimeChannels.length,
        },
        {
            name: 'Presence',
            status: window.PresenceManager?.channel ? 'TRACKING' : 'PENDING',
            detail: `${formatCount(activeUsers)} utilisateur${activeUsers > 1 ? 's' : ''} detecte${activeUsers > 1 ? 's' : ''}.`,
            value: activeUsers,
        },
        {
            name: 'Orders',
            status: state.realtimeChannels.find((entry) => entry.name === 'orders')?.status || 'WAITING',
            detail: `${formatCount(window.OrderManager?.getOrders?.() || window.OrderManager?.data || [])} commande${(window.OrderManager?.getOrders?.() || window.OrderManager?.data || []).length > 1 ? 's' : ''}.`,
            value: (window.OrderManager?.getOrders?.() || window.OrderManager?.data || []).length,
        },
        {
            name: 'Products',
            status: state.realtimeChannels.find((entry) => entry.name === 'products')?.status || 'WAITING',
            detail: `${formatCount(window.ProductManager?.getProducts?.() || [])} produit${(window.ProductManager?.getProducts?.() || []).length > 1 ? 's' : ''}.`,
            value: (window.ProductManager?.getProducts?.() || []).length,
        },
        {
            name: 'Notifications',
            status: state.realtimeChannels.find((entry) => entry.name === 'notifications')?.status || 'WAITING',
            detail: `${formatCount(window.NotificationManager?.getNotifications?.() || [])} notification${(window.NotificationManager?.getNotifications?.() || []).length > 1 ? 's' : ''}.`,
            value: (window.NotificationManager?.getNotifications?.() || []).length,
        },
        {
            name: 'Analytics',
            status: state.realtimeChannels.find((entry) => entry.name === 'analytics_events')?.status || 'WAITING',
            detail: `${formatCount(state.snapshotCounts.analytics || 0)} signal${(state.snapshotCounts.analytics || 0) > 1 ? 's' : ''} recent${(state.snapshotCounts.analytics || 0) > 1 ? 's' : ''}.`,
            value: state.snapshotCounts.analytics || 0,
        },
        {
            name: 'Activities',
            status: state.realtimeChannels.find((entry) => entry.name === 'activities')?.status || 'WAITING',
            detail: `${formatCount(window.ActivityManager?.getActivities?.() || [])} activite${(window.ActivityManager?.getActivities?.() || []).length > 1 ? 's' : ''}.`,
            value: (window.ActivityManager?.getActivities?.() || []).length,
        },
        {
            name: 'Incidents',
            status: state.realtimeChannels.find((entry) => entry.name === 'system_health_incidents')?.status || 'WAITING',
            detail: `${formatCount(state.events.filter((event) => event.type === 'incident' && !event.meta?.resolved).length)} signal${state.events.filter((event) => event.type === 'incident' && !event.meta?.resolved).length > 1 ? 's' : ''} actifs.`,
            value: state.events.filter((event) => event.type === 'incident' && !event.meta?.resolved).length,
        },
    ];

    const statusClasses = {
        READY: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        TRACKING: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        SUBSCRIBED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        CONNECTED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        WAITING: 'bg-amber-50 text-amber-700 border-amber-100',
        PENDING: 'bg-gray-50 text-gray-600 border-gray-100',
        MISSING: 'bg-red-50 text-red-700 border-red-100',
        ERROR: 'bg-red-50 text-red-700 border-red-100',
        CLOSED: 'bg-gray-50 text-gray-600 border-gray-100',
    };

    list.innerHTML = channels.map((item) => {
        const cls = statusClasses[item.status] || statusClasses.PENDING;
        return `
            <div class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                        <div class="text-sm font-black text-gray-900">${escapeHtml(item.name)}</div>
                        <div class="mt-1 text-xs text-gray-500">${escapeHtml(item.detail)}</div>
                    </div>
                    <span class="flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${cls}">${escapeHtml(item.status)}</span>
                </div>
                <div class="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">${formatCount(item.value)} elements</div>
            </div>
        `;
    }).join('');
}

function renderPresence(users) {
    const list = $id('livePresenceList');
    if (!list) return;

    const filtered = filterOutAdminPresence(users);
    const countLine = $id('presenceCountLine');
    if (countLine) countLine.textContent = `${formatCount(filtered.length)} en ligne (admin exclu)`;

    if (!filtered.length) {
        list.innerHTML = `<div class="text-xs text-gray-400 italic">Aucun utilisateur actif pour le moment.</div>`;
        updateChannelHealth();
        return;
    }

    const roleColors = {
        supplier: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Vendeur' },
        customer: { bg: 'bg-green-100', text: 'text-green-700', label: 'Acheteur' },
        guest: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Invite' },
    };

    Promise.resolve(primeRealtimeProfiles(filtered)).then(() => {
        list.innerHTML = filtered.map((presenceUser) => {
            const role = presenceUser.role || 'guest';
            const colors = roleColors[role] || roleColors.guest;
            const profile = presenceUser?.user_id ? state.realtimeProfileCache.get(presenceUser.user_id) : null;
            const mergedUser = { ...presenceUser, ...profile };
            const name = getUserDisplayName(mergedUser) || 'Anonyme';
            const page = presenceUser.page ? presenceUser.page.split('/').pop().replace('.html', '') || 'accueil' : '-';
            return `
                <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors live-presence-item" data-user-id="${escapeHtml(mergedUser?.id || mergedUser?.user_id || '')}">
                    ${renderUserAvatar(mergedUser, name)}
                    <div class="flex-1 min-w-0">
                        <div class="text-xs font-bold text-gray-900 truncate">${escapeHtml(name)}</div>
                        <div class="text-[10px] text-gray-400 truncate">/${escapeHtml(page)}</div>
                    </div>
                    <span class="text-[9px] font-black uppercase tracking-wider ${colors.bg} ${colors.text} px-1.5 py-0.5 rounded-full flex-shrink-0">${colors.label}</span>
                </div>
            `;
        }).join('');
        // Attach click handler
        list.querySelectorAll('.live-presence-item').forEach((el) => {
            el.addEventListener('click', () => {
                const uid = el.dataset.userId;
                const presence = filtered.find((u) => (u?.id || u?.user_id) === uid) || {};
                const profile = state.realtimeProfileCache.get(uid) || {};
                const merged = { ...presence, ...profile };
                showUserIdentity(merged);
            });
        });
        updateChannelHealth();
    });
}
async function primeRealtimeProfiles(users) {
    const ids = [...new Set(
        (users || [])
            .map((user) => user?.user_id)
            .filter((id) => !!id && !state.realtimeProfileCache.has(id))
    )];

    if (!ids.length || !window.SupabaseAdapter?.getClient) return;

    try {
        const client = window.SupabaseAdapter.getClient();
        const { data, error } = await client
            .from('users')
            .select('*')
            .in('id', ids);

        if (error) throw error;

        (data || []).forEach((profile) => {
            state.realtimeProfileCache.set(profile.id, profile);
        });
    } catch (error) {
        console.warn('[Admin realtime] Unable to enrich presence profiles:', error?.message || error);
    }
}

function getVisibleFeedCount() {
    const list = $id('liveEventList');
    const filtered = state.events.filter((event) => withinFeedWindow(event.timestamp) && eventMatchesFilter(event));

    if (!list) return filtered.length;

    if (!filtered.length) {
        list.innerHTML = `
            <div class="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <div class="text-sm font-bold text-gray-900">Aucun evenement ne correspond au filtre.</div>
                <div class="mt-1 text-xs text-gray-500">Change la recherche, la periode ou le type pour retrouver le flux.</div>
            </div>
        `;
        return filtered.length;
    }

    list.innerHTML = filtered.map((event) => {
        const meta = TYPE_META[event.type] || TYPE_META.system;
        const chips = [
            event.source ? `<span class="rounded-full border border-gray-200 bg-white px-2 py-1">${escapeHtml(event.source)}</span>` : '',
            event.actor ? `<span class="rounded-full border border-gray-200 bg-white px-2 py-1">${escapeHtml(event.actor)}</span>` : '',
            event.meta?.id ? `<span class="rounded-full border border-gray-200 bg-white px-2 py-1">ID ${escapeHtml(String(event.meta.id).slice(0, 10))}</span>` : '',
            event.meta?.status ? `<span class="rounded-full border border-gray-200 bg-white px-2 py-1">${escapeHtml(event.meta.status)}</span>` : '',
            event.meta?.channel ? `<span class="rounded-full border border-gray-200 bg-white px-2 py-1">${escapeHtml(event.meta.channel)}</span>` : '',
        ].filter(Boolean).join('');

        return `
            <article class="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-gray-200">
                <div class="flex items-start gap-4">
                    <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${meta.badge}">
                        <iconify-icon icon="${meta.icon}" width="22"></iconify-icon>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div class="min-w-0">
                                <div class="truncate text-sm font-black text-gray-900">${escapeHtml(event.title)}</div>
                                <div class="mt-1 text-sm text-gray-500">${escapeHtml(event.detail)}</div>
                            </div>
                            <div class="flex-shrink-0 text-right">
                                <div class="text-[10px] font-black uppercase tracking-widest text-gray-400">${formatRelative(event.timestamp)}</div>
                                <div class="mt-1 text-[10px] text-gray-400">${formatClock(event.timestamp)}</div>
                            </div>
                        </div>
                        <div class="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                            <span class="rounded-full ${meta.badge} px-2 py-1">${meta.label}</span>
                            ${chips}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    return filtered.length;
}

function renderTopVendorsSkeleton() {
    const grid = $id('topVendorsGrid');
    if (!grid) return;
    grid.innerHTML = `
        <div class="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm text-center">
            <div class="w-16 h-16 mx-auto skeleton skeleton-avatar" style="border-radius: 9999px;"></div>
            <div class="mt-4 skeleton skeleton-text" style="width: 70%; height: 12px; margin: 0 auto 8px auto;"></div>
            <div class="skeleton skeleton-text" style="width: 45%; height: 10px; margin: 0 auto;"></div>
        </div>
        <div class="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm text-center">
            <div class="w-16 h-16 mx-auto skeleton skeleton-avatar" style="border-radius: 9999px;"></div>
            <div class="mt-4 skeleton skeleton-text" style="width: 78%; height: 12px; margin: 0 auto 8px auto;"></div>
            <div class="skeleton skeleton-text" style="width: 50%; height: 10px; margin: 0 auto;"></div>
        </div>
        <div class="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm text-center">
            <div class="w-16 h-16 mx-auto skeleton skeleton-avatar" style="border-radius: 9999px;"></div>
            <div class="mt-4 skeleton skeleton-text" style="width: 62%; height: 12px; margin: 0 auto 8px auto;"></div>
            <div class="skeleton skeleton-text" style="width: 42%; height: 10px; margin: 0 auto;"></div>
        </div>
    `;
}

async function renderTopVendors({ days, range } = {}) {
    const grid = $id('topVendorsGrid');
    const meta = $id('topVendorsMeta');
    if (!grid) return;

    renderTopVendorsSkeleton();
    if (meta) {
        meta.innerHTML = `<span class="skeleton skeleton-text inline-block align-middle" style="width: 110px; height: 12px; margin: 0;"></span>`;
    }

    const orderSource = window.OrderManager?.getOrders?.() || window.OrderManager?.data || [];
    const leads = (orderSource || []).filter((lead) => {
        if (range && (range.start || range.end)) return isLeadInRealtimeRange(lead, range);
        const sinceMs = Math.max(1, Number(days || 7)) * 24 * 60 * 60 * 1000;
        const timestamp = new Date(lead?.date || lead?.created_at || 0).getTime();
        return timestamp && (Date.now() - timestamp) <= sinceMs;
    });

    let suppliers = [];
    if (window.UserManager?.getUsers && window.UserManager._initialized) {
        suppliers = window.UserManager.getUsers().filter((user) => user?.role === 'supplier');
    } else if (getClient()) {
        const client = getClient();
        const { data, error } = await client.from('users').select('*').eq('role', 'supplier');
        if (error) {
            grid.innerHTML = `<div class="p-10 text-center text-gray-400 text-sm italic col-span-3">Erreur chargement boutiques.</div>`;
            return;
        }
        suppliers = data || [];
    }

    const performance = {};
    leads.forEach((lead) => {
        if (!lead?.vendor_id) return;
        performance[lead.vendor_id] = (performance[lead.vendor_id] || 0) + 1;
    });

    const topVendors = suppliers
        .map((user) => ({ ...user, score: performance[user.id] || 0 }))
        .filter((user) => user.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    if (meta) {
        meta.textContent = (range && (range.start || range.end))
            ? `${formatCount(leads.length)} leads | ${range.start || '...'} -> ${range.end || '...'}`
            : `${formatCount(leads.length)} leads | ${days}j`;
    }

    if (!topVendors.length) {
        grid.innerHTML = `<div class="p-10 text-center text-gray-400 text-sm italic col-span-3">Aucune boutique sur la periode.</div>`;
        return;
    }

    grid.innerHTML = topVendors.map((vendor, idx) => `
        <div class="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-center">
            <div class="w-16 h-16 mx-auto flex items-center justify-center">
                ${renderUserAvatar(vendor, getUserDisplayName(vendor), 'w-16 h-16')}
            </div>
            <div class="mt-4 font-black text-gray-900 truncate">${escapeHtml(getUserDisplayName(vendor))}</div>
            <div class="mt-1 text-[10px] font-black uppercase tracking-widest text-green-600">${formatCount(vendor.score)} leads</div>
            <div class="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <span class="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px]">#${idx + 1}</span>
                Top
            </div>
        </div>
    `).join('');
}

function normalizeNotificationType(type) {
    const raw = String(type || '').toLowerCase();
    if (raw.startsWith('broadcast-modal:')) return raw.split(':').slice(1).join(':') || 'info';
    if (raw.startsWith('broadcast:')) return raw.split(':')[1] || 'info';
    if (raw === 'broadcast') return 'info';
    return raw || 'info';
}

function shortId(value) {
    return String(value || '').slice(0, 8);
}

function makeEventSignature(entry) {
    return [
        entry.type,
        entry.source,
        entry.title,
        entry.detail,
        entry.actor,
        entry.meta?.id || '',
        entry.meta?.status || '',
        entry.meta?.channel || '',
    ].join('|');
}

function pushEvent(entry, options = {}) {
    const timestamp = entry.timestamp || new Date().toISOString();
    const normalized = {
        id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: entry.type || 'system',
        source: entry.source || 'system',
        title: entry.title || 'Evenement',
        detail: entry.detail || '',
        actor: entry.actor || '',
        timestamp,
        severity: entry.severity || 'info',
        meta: entry.meta || {},
    };

    const signature = options.signature || makeEventSignature(normalized);
    const now = Date.now();
    const lastSeen = state.dedupe.get(signature) || 0;
    if (now - lastSeen < 1200) return null;
    state.dedupe.set(signature, now);
    state.events.unshift(normalized);
    if (state.events.length > 120) state.events.length = 120;
    state.lastEvent = normalized;
    if (normalized.type === 'incident') {
        state.latestIncident = normalized;
    }

    if (!state.ready || state.paused) {
        updateMetrics();
        updateChannelHealth();
        return normalized;
    }

    renderFeed();
    updateMetrics();
    updateChannelHealth();
    return normalized;
}

function seedSnapshotEvents() {
    state.events = [];
    state.latestIncident = null;
    const now = new Date().toISOString();
    const orders = window.OrderManager?.getOrders?.() || window.OrderManager?.data || [];
    const products = window.ProductManager?.getProducts?.() || [];
    const notifications = window.NotificationManager?.getNotifications?.() || [];
    const activities = window.ActivityManager?.getActivities?.() || [];
    const presence = filterOutAdminPresence(window.PresenceManager?.getActiveUsers?.() || []);

    const snapshot = [
        { key: 'orders', count: orders.length, title: 'Commandes chargees', detail: `${formatCount(orders.length)} commandes disponibles pour le suivi live.`, type: 'order', source: 'snapshot', severity: 'info' },
        { key: 'products', count: products.length, title: 'Catalogue charge', detail: `${formatCount(products.length)} produits visibles dans la plateforme.`, type: 'product', source: 'snapshot', severity: 'info' },
        { key: 'notifications', count: notifications.length, title: 'Notifications chargees', detail: `${formatCount(notifications.length)} notifications presentes dans le flux.`, type: 'notification', source: 'snapshot', severity: 'info' },
        { key: 'activities', count: activities.length, title: 'Activites chargees', detail: `${formatCount(activities.length)} actions recentes dans le journal.`, type: 'activity', source: 'snapshot', severity: 'info' },
        { key: 'presence', count: presence.length, title: 'Presence synchronisee', detail: `${formatCount(presence.length)} utilisateurs actifs detectes.`, type: 'presence', source: 'snapshot', severity: 'info' },
    ];

    snapshot.forEach((item) => {
        state.snapshotCounts[item.key] = item.count;
        if (item.count > 0) {
            pushEvent({
                type: item.type,
                source: item.source,
                title: item.title,
                detail: item.detail,
                severity: item.severity,
                timestamp: now,
                meta: { count: item.count },
            }, { signature: `snapshot:${item.key}:${item.count}` });
        }
    });
}

async function seedIncidentSnapshot() {
    const client = getClient();
    if (!client?.from) return;

    try {
        const { data, error } = await client
            .from('system_health_incidents')
            .select('id, created_at, detected_at, priority, severity, category, title, summary, status, owner')
            .limit(10);

        if (error || !Array.isArray(data) || !data.length) return;

        const ranked = [...data].sort((a, b) => {
            const aTime = new Date(a.detected_at || a.created_at || 0).getTime();
            const bTime = new Date(b.detected_at || b.created_at || 0).getTime();
            return bTime - aTime;
        });
        const active = ranked.find((item) => !String(item.status || '').toLowerCase().includes('resolved'));
        if (!active) return;

        const severity = String(active.priority || active.severity || '').toUpperCase();
        const type = severity === 'P0' || severity === 'P1' ? 'incident' : 'system';
        const details = active.summary || `${active.category || 'Incident'} ${active.status ? `(${active.status})` : ''}`.trim();

        pushEvent({
            type,
            source: 'snapshot',
            title: active.title || 'Incident detecte',
            detail: details,
            severity: severity === 'P0' ? 'danger' : (severity === 'P1' ? 'warn' : 'info'),
            timestamp: active.detected_at || active.created_at || new Date().toISOString(),
            meta: {
                id: active.id,
                status: active.status || '',
                channel: 'system_health_incidents',
                category: active.category || '',
                priority: active.priority || active.severity || '',
            },
        }, { signature: `snapshot:incident:${active.id}:${active.status || ''}:${active.priority || active.severity || ''}` });
    } catch (err) {
        console.warn('[Admin realtime] incident snapshot failed:', err?.message || err);
    }
}

async function seedAnalyticsSnapshot() {
    const client = getClient();
    if (!client?.from) return;

    try {
        const { data, error } = await client
            .from('analytics_events')
            .select('id, event_type, user_id, user_role, session_id, path, page_title, target, active_ms, metadata, created_at, user_agent')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error || !Array.isArray(data) || !data.length) return;

        state.snapshotCounts.analytics = data.length;
        const latest = data[0];
        const eventType = String(latest.event_type || 'analytics').toLowerCase();
        pushEvent({
            type: 'traffic',
            source: 'snapshot',
            title: `Dernier signal analytics: ${latest.page_title || latest.path || eventType}`,
            detail: `${eventType}${latest.target ? ` | ${latest.target}` : ''}${latest.active_ms ? ` | ${formatDurationMs(latest.active_ms)}` : ''}.`,
            actor: latest.user_role || latest.user_id || latest.session_id || '',
            timestamp: latest.created_at || new Date().toISOString(),
            severity: 'info',
            meta: {
                id: latest.id,
                status: eventType,
                channel: 'analytics_events',
                path: latest.path || '',
                page_title: latest.page_title || '',
                target: latest.target || '',
            },
        }, { signature: `snapshot:analytics:${latest.id}:${latest.event_type || ''}:${latest.created_at || ''}` });
    } catch (err) {
        console.warn('[Admin realtime] analytics snapshot failed:', err?.message || err);
    }
}

function handleManagerSummary(kind) {
    if (!state.ready) return;
    if (kind === 'orders') {
        const orders = window.OrderManager?.getOrders?.() || window.OrderManager?.data || [];
        const prev = state.snapshotCounts.orders;
        state.snapshotCounts.orders = orders.length;
        const delta = orders.length - prev;
        pushEvent({
            type: 'order',
            source: 'manager',
            title: delta >= 0 ? 'Flux commandes actualise' : 'Flux commandes reduit',
            detail: `${formatCount(orders.length)} commandes en memoire${delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}.`,
            timestamp: new Date().toISOString(),
            meta: { count: orders.length, delta },
        }, { signature: `manager:orders:${orders.length}:${delta}` });
    } else if (kind === 'products') {
        const products = window.ProductManager?.getProducts?.() || [];
        const prev = state.snapshotCounts.products;
        state.snapshotCounts.products = products.length;
        const delta = products.length - prev;
        pushEvent({
            type: 'product',
            source: 'manager',
            title: delta >= 0 ? 'Catalogue actualise' : 'Catalogue reduit',
            detail: `${formatCount(products.length)} produits en memoire${delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}.`,
            timestamp: new Date().toISOString(),
            meta: { count: products.length, delta },
        }, { signature: `manager:products:${products.length}:${delta}` });
    } else if (kind === 'notifications') {
        const notifs = window.NotificationManager?.getNotifications?.() || [];
        const prev = state.snapshotCounts.notifications;
        state.snapshotCounts.notifications = notifs.length;
        const delta = notifs.length - prev;
        pushEvent({
            type: 'notification',
            source: 'manager',
            title: 'Notifications synchronisees',
            detail: `${formatCount(notifs.length)} notifications en memoire${delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}.`,
            timestamp: new Date().toISOString(),
            meta: { count: notifs.length, delta },
        }, { signature: `manager:notifs:${notifs.length}:${delta}` });
    } else if (kind === 'activities') {
        const items = window.ActivityManager?.getActivities?.() || [];
        const prev = state.snapshotCounts.activities;
        state.snapshotCounts.activities = items.length;
        const delta = items.length - prev;
        pushEvent({
            type: 'activity',
            source: 'manager',
            title: 'Journal actualise',
            detail: `${formatCount(items.length)} activites en memoire${delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}.`,
            timestamp: new Date().toISOString(),
            meta: { count: items.length, delta },
        }, { signature: `manager:activities:${items.length}:${delta}` });
    }
    renderFeed();
    updateMetrics();
    updateChannelHealth();
}

function getOrderStatusLabel(status) {
    if (!window.OrderManager?.getStatusLabel) return status || 'Inconnu';
    return window.OrderManager.getStatusLabel(status);
}

function syncIncidentState(incidentId) {
    if (!incidentId) return;
    state.events.forEach((event) => {
        if (event.type === 'incident' && String(event.meta?.id || '') === String(incidentId)) {
            event.meta = { ...event.meta, resolved: true };
        }
    });
    if (state.latestIncident && String(state.latestIncident.meta?.id || '') === String(incidentId)) {
        state.latestIncident = { ...state.latestIncident, meta: { ...state.latestIncident.meta, resolved: true } };
    }
}

function handleDbEvent(table, eventType, payload) {
    const row = payload?.new || payload?.old || {};
    const timestamp = row.updated_at || row.created_at || row.date || new Date().toISOString();

    if (table === 'orders') {
        const status = row.status || row.payment_status || 'PENDING';
        const label = getOrderStatusLabel(status);
        pushEvent({
            type: 'order',
            source: 'supabase',
            title: eventType === 'INSERT'
                ? `Nouvelle commande ${shortId(row.id)}`
                : `Commande ${shortId(row.id)} mise a jour`,
            detail: `${label}${row.customer_name ? ` pour ${row.customer_name}` : ''}.`,
            actor: row.vendor_id || row.customer_id || row.customer_email || '',
            timestamp,
            severity: ['CANCELLED', 'FROZEN', 'REFUNDED'].includes(String(status).toUpperCase()) ? 'danger' : (eventType === 'INSERT' ? 'success' : 'info'),
            meta: { id: row.id, status, channel: 'orders' },
        }, { signature: `db:orders:${eventType}:${row.id}:${status}:${timestamp}` });
        return;
    }

    if (table === 'products') {
        pushEvent({
            type: 'product',
            source: 'supabase',
            title: eventType === 'INSERT'
                ? `Produit publie: ${row.name || 'Produit'}`
                : `Produit mis a jour: ${row.name || 'Produit'}`,
            detail: `${row.category || 'Categorie inconnue'}${row.stock != null ? ` | stock ${row.stock}` : ''}.`,
            actor: row.supplier_email || row.user_id || '',
            timestamp,
            severity: eventType === 'INSERT' ? 'success' : 'info',
            meta: { id: row.id, status: row.status || '', channel: 'products' },
        }, { signature: `db:products:${eventType}:${row.id}:${row.updated_at || row.created_at || ''}` });
        return;
    }

    if (table === 'notifications') {
        const notifType = normalizeNotificationType(row.type);
        pushEvent({
            type: 'notification',
            source: 'supabase',
            title: row.title || 'Notification',
            detail: row.message || `Type ${notifType}.`,
            actor: row.user_email || row.user_id || row.target_role || '',
            timestamp,
            severity: String(row.type || '').includes('broadcast') ? 'warn' : 'info',
            meta: { id: row.id, status: notifType, channel: 'notifications' },
        }, { signature: `db:notifications:${eventType}:${row.id}:${row.type || ''}:${timestamp}` });
        return;
    }

    if (table === 'analytics_events') {
        const eventTypeName = String(row.event_type || 'analytics').toLowerCase();
        const title = row.page_title || row.path || eventTypeName || 'Signal analytics';
        const detailParts = [
            row.path || '',
            row.target || '',
            row.user_role || '',
            row.active_ms ? formatDurationMs(row.active_ms) : '',
        ].filter(Boolean);
        pushEvent({
            type: 'traffic',
            source: 'supabase',
            title: `${eventTypeName.toUpperCase()} | ${title}`,
            detail: detailParts.join(' | ') || 'Signal analytics recu.',
            actor: row.user_id || row.session_id || row.user_role || '',
            timestamp: row.created_at || timestamp,
            severity: 'info',
            meta: {
                id: row.id,
                status: eventTypeName,
                channel: 'analytics_events',
                path: row.path || '',
                page_title: row.page_title || '',
                target: row.target || '',
                active_ms: row.active_ms || 0,
            },
        }, { signature: `db:analytics:${eventType}:${row.id}:${eventTypeName}:${row.path || ''}:${row.created_at || timestamp}` });
        return;
    }

    if (table === 'activities') {
        pushEvent({
            type: 'activity',
            source: 'supabase',
            title: row.text || (eventType === 'INSERT' ? 'Nouvelle activite' : 'Activite mise a jour'),
            detail: `${row.type || 'system'}${row.user_email ? ` | ${row.user_email}` : ''}.`,
            actor: row.user_email || row.user_id || '',
            timestamp: row.time || timestamp,
            severity: String(row.type || '').toLowerCase().includes('error') ? 'warn' : 'info',
            meta: { id: row.id, status: row.type || '', channel: 'activities' },
        }, { signature: `db:activities:${eventType}:${row.id}:${row.type || ''}:${row.time || timestamp}` });
        return;
    }

    if (table === 'order_status_history') {
        const status = row.new_status || row.previous_status || 'unknown';
        pushEvent({
            type: 'order',
            source: 'supabase',
            title: `Historique commande ${shortId(row.order_id)}`,
            detail: `${row.previous_status || 'UNKNOWN'} -> ${row.new_status || 'UNKNOWN'}${row.notes ? ` | ${row.notes}` : ''}.`,
            actor: row.changed_by || '',
            timestamp: row.changed_at || timestamp,
            severity: ['CANCELLED', 'FROZEN', 'REFUNDED', 'FAILED'].includes(String(status).toUpperCase()) ? 'danger' : 'info',
            meta: { id: row.order_id, status, channel: 'order_status_history' },
        }, { signature: `db:order_history:${eventType}:${row.order_id}:${status}:${row.changed_at || timestamp}` });
        return;
    }

    if (table === 'shop_views') {
        const viewer = row.viewer_user_id || row.session_id || row.ip_hash || 'visiteur';
        pushEvent({
            type: 'traffic',
            source: 'supabase',
            title: `Visite boutique ${shortId(row.vendor_id)}`,
            detail: `${row.user_agent || 'Navigateur inconnu'}${row.viewer_user_id ? ' | compte connecte' : ' | visite anonyme'}.`,
            actor: viewer,
            timestamp: row.created_at || timestamp,
            severity: 'info',
            meta: { id: row.id, status: 'view', channel: 'shop_views', vendor: row.vendor_id || '' },
        }, { signature: `db:shop_views:${eventType}:${row.id}:${row.session_id || row.ip_hash || row.created_at || timestamp}` });
        return;
    }

    if (table === 'system_health_incidents') {
        const priority = String(row.priority || row.severity || '').toUpperCase();
        const activeStatus = String(row.status || '').toLowerCase();
        const isResolved = activeStatus.includes('resolved') || activeStatus.includes('closed');
        syncIncidentState(row.id);
        pushEvent({
            type: 'incident',
            source: 'supabase',
            title: row.title || `Incident ${priority || 'systeme'}`,
            detail: `${row.summary || row.category || 'Incident systeme'}${row.owner ? ` | owner ${row.owner}` : ''}.`,
            actor: row.owner || row.category || '',
            timestamp: row.detected_at || row.created_at || timestamp,
            severity: priority === 'P0' ? 'danger' : (priority === 'P1' ? 'warn' : (isResolved ? 'info' : 'warn')),
            meta: {
                id: row.id,
                status: row.status || '',
                channel: 'system_health_incidents',
                priority,
                category: row.category || '',
                resolved: isResolved,
            },
        }, { signature: `db:incidents:${eventType}:${row.id}:${row.status || ''}:${priority}:${row.detected_at || row.created_at || timestamp}` });
    }
}

function getFilteredFeedEvents() {
    return state.events.filter((event) => withinFeedWindow(event.timestamp) && eventMatchesFilter(event));
}

function renderFeed() {
    const list = $id('liveEventList');
    if (!list) return 0;

    const filtered = getFilteredFeedEvents();
    state.lastRenderedVisibleCount = filtered.length;

    if (!filtered.length) {
        list.innerHTML = `
            <div class="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <div class="text-sm font-bold text-gray-900">Aucun evenement ne correspond au filtre.</div>
                <div class="mt-1 text-xs text-gray-500">Change la recherche, la periode ou le type pour retrouver le flux.</div>
            </div>
        `;
        return filtered.length;
    }

    list.innerHTML = filtered.map((event) => {
        const meta = TYPE_META[event.type] || TYPE_META.system;
        const chips = [
            event.source ? `<span class="rounded-full border border-gray-200 bg-white px-2 py-1">${escapeHtml(event.source)}</span>` : '',
            event.actor ? `<span class="rounded-full border border-gray-200 bg-white px-2 py-1">${escapeHtml(event.actor)}</span>` : '',
            event.meta?.id ? `<span class="rounded-full border border-gray-200 bg-white px-2 py-1">ID ${escapeHtml(String(event.meta.id).slice(0, 10))}</span>` : '',
            event.meta?.status ? `<span class="rounded-full border border-gray-200 bg-white px-2 py-1">${escapeHtml(event.meta.status)}</span>` : '',
            event.meta?.channel ? `<span class="rounded-full border border-gray-200 bg-white px-2 py-1">${escapeHtml(event.meta.channel)}</span>` : '',
        ].filter(Boolean).join('');

        return `
            <article class="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-gray-200">
                <div class="flex items-start gap-4">
                    <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${meta.badge}">
                        <iconify-icon icon="${meta.icon}" width="22"></iconify-icon>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div class="min-w-0">
                                <div class="truncate text-sm font-black text-gray-900">${escapeHtml(event.title)}</div>
                                <div class="mt-1 text-sm text-gray-500">${escapeHtml(event.detail)}</div>
                            </div>
                            <div class="flex-shrink-0 text-right">
                                <div class="text-[10px] font-black uppercase tracking-widest text-gray-400">${formatRelative(event.timestamp)}</div>
                                <div class="mt-1 text-[10px] text-gray-400">${formatClock(event.timestamp)}</div>
                            </div>
                        </div>
                        <div class="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                            <span class="rounded-full ${meta.badge} px-2 py-1">${meta.label}</span>
                            ${chips}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    return filtered.length;
}

function exportFeedSnapshot() {
    const filtered = getFilteredFeedEvents();
    const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
    const filename = `newket-realtime-feed-${stamp}.csv`;
    const csv = buildFeedCsv(filtered);
    downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
    pushEvent({
        type: 'system',
        source: 'ui',
        title: 'Flux exporte',
        detail: `${formatCount(filtered.length)} evenement${filtered.length > 1 ? 's' : ''} exporte${filtered.length > 1 ? 's' : ''} en CSV.`,
        timestamp: new Date().toISOString(),
        severity: 'info',
        meta: { id: filename, status: 'export', channel: 'ui' },
    }, { signature: `ui:export:${filename}:${filtered.length}` });
}

function setTopVendorRangeButtons(days) {
    document.querySelectorAll('.rt-range-btn').forEach((btn) => {
        const active = days != null && Number(btn.dataset.days) === Number(days);
        btn.classList.toggle('bg-black', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('bg-white', !active);
        btn.classList.toggle('border', !active);
        btn.classList.toggle('border-gray-200', !active);
        btn.classList.toggle('text-gray-500', !active);
    });
}

function syncTopVendorDateInputs() {
    const start = $id('realtimeDateStart');
    const end = $id('realtimeDateEnd');
    if (start) start.value = state.currentRealtimeDateRange.start || '';
    if (end) end.value = state.currentRealtimeDateRange.end || '';
}

function getTopVendorDateRangeFromInputs() {
    return {
        start: $id('realtimeDateStart')?.value || null,
        end: $id('realtimeDateEnd')?.value || null,
    };
}

function setTopVendorFiltersVisible(isVisible) {
    const panel = $id('realtimeDateFilters');
    const button = $id('toggleRealtimeDateFiltersBtn');
    if (panel) panel.hidden = !isVisible;
    if (button) button.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
}

function toggleTopVendorFilters() {
    const panel = $id('realtimeDateFilters');
    setTopVendorFiltersVisible(!(panel && !panel.hidden));
}

function applyTopVendorDateRange() {
    state.currentRealtimeDateRange = getTopVendorDateRangeFromInputs();
    state.currentDays = (state.currentRealtimeDateRange.start || state.currentRealtimeDateRange.end) ? null : 7;
    setTopVendorRangeButtons(state.currentDays);
    setTopVendorFiltersVisible(true);
    renderTopVendors(
        (state.currentRealtimeDateRange.start || state.currentRealtimeDateRange.end)
            ? { range: state.currentRealtimeDateRange }
            : { days: state.currentDays }
    ).catch(() => {});
}

function clearTopVendorDateRange() {
    state.currentRealtimeDateRange = { start: null, end: null };
    state.currentDays = 7;
    syncTopVendorDateInputs();
    setTopVendorRangeButtons(state.currentDays);
    setTopVendorFiltersVisible(false);
    renderTopVendors({ days: state.currentDays }).catch(() => {});
}

async function refreshManagers(force = false) {
    const tasks = [];
    if (window.OrderManager?.init) tasks.push(window.OrderManager.init({ force: true }).catch(() => {}));
    if (window.ProductManager?.init) tasks.push(window.ProductManager.init().catch(() => {}));
    if (window.ActivityManager?.init) tasks.push(window.ActivityManager.init(force).catch(() => {}));
    if (window.NotificationManager?.init) tasks.push(window.NotificationManager.init(force).catch(() => {}));
    await Promise.allSettled(tasks);
}

async function setupRealtimeMonitor() {
    cleanupRealtimeChannels();

    const client = getClient();
    if (!client) {
        updateChannelHealth();
        return;
    }

    const specs = [
        { name: 'orders', events: ['INSERT', 'UPDATE'] },
        { name: 'products', events: ['INSERT', 'UPDATE'] },
        { name: 'notifications', events: ['INSERT', 'UPDATE'] },
        { name: 'analytics_events', events: ['INSERT'] },
        { name: 'activities', events: ['INSERT'] },
        { name: 'order_status_history', events: ['INSERT'] },
        { name: 'shop_views', events: ['INSERT'] },
        { name: 'system_health_incidents', events: ['INSERT', 'UPDATE'] },
    ];

    specs.forEach((spec) => {
        const channel = client.channel(`admin-realtime:${spec.name}`);
        spec.events.forEach((event) => {
            channel.on('postgres_changes', { event, schema: 'public', table: spec.name }, (payload) => {
                handleDbEvent(spec.name, event, payload);
            });
        });
        channel.subscribe((status) => {
            const existing = state.realtimeChannels.find((entry) => entry.name === spec.name);
            if (existing) {
                existing.status = status;
                existing.updatedAt = new Date().toISOString();
            } else {
                state.realtimeChannels.push({ name: spec.name, channel, status, updatedAt: new Date().toISOString() });
            }

            if (status === 'SUBSCRIBED') {
                pushEvent({
                    type: 'system',
                    source: 'supabase',
                    title: `Canal ${spec.name} connecte`,
                    detail: `Le canal ${spec.name} est en ecoute live.`,
                    timestamp: new Date().toISOString(),
                    meta: { id: spec.name, status, channel: spec.name },
                }, { signature: `channel:${spec.name}:subscribed` });
            }

            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                pushEvent({
                    type: 'system',
                    source: 'supabase',
                    title: `Canal ${spec.name} en ${status.toLowerCase()}`,
                    detail: `Le suivi live du canal ${spec.name} a rencontree un probleme.`,
                    severity: 'danger',
                    timestamp: new Date().toISOString(),
                    meta: { id: spec.name, status, channel: spec.name },
                }, { signature: `channel:${spec.name}:${status}` });
            }

            updateChannelHealth();
        });
        state.realtimeChannels.push({ name: spec.name, channel, status: 'CONNECTING', updatedAt: new Date().toISOString() });
    });

    updateChannelHealth();
}

function cleanupRealtimeChannels() {
    const client = getClient();
    if (client && state.realtimeChannels.length) {
        state.realtimeChannels.forEach((entry) => {
            try {
                client.removeChannel(entry.channel);
            } catch (err) {
                console.warn('[Admin realtime] removeChannel failed:', err?.message || err);
            }
        });
    }
    state.realtimeChannels = [];
}

function renderAndSeed() {
    seedSnapshotEvents();
    renderPresence(window.PresenceManager?.getActiveUsers?.() || []);
    renderFeed();
    updateMetrics();
    updateChannelHealth();
}

function bindLocalListeners() {
    window.addEventListener('presenceUpdated', (e) => {
        renderPresence(e.detail?.users || []);
        if (!state.ready) return;
        pushEvent({
            type: 'presence',
            source: 'manager',
            title: 'Presence mise a jour',
            detail: `${formatCount(e.detail?.count || (e.detail?.users || []).length || 0)} utilisateurs actifs.`,
            timestamp: new Date().toISOString(),
            meta: { count: e.detail?.count || (e.detail?.users || []).length || 0, channel: 'presence' },
        }, { signature: `presence:${e.detail?.count || (e.detail?.users || []).length || 0}` });
    });

    window.addEventListener('ordersUpdated', () => {
        if (!state.ready) return;
        handleManagerSummary('orders');
        renderTopVendors({ days: state.currentDays, range: state.currentRealtimeDateRange }).catch(() => {});
    });

    window.addEventListener('productsUpdated', () => {
        if (!state.ready) return;
        handleManagerSummary('products');
        renderTopVendors({ days: state.currentDays, range: state.currentRealtimeDateRange }).catch(() => {});
    });

    window.addEventListener('notificationsUpdated', () => {
        if (!state.ready) return;
        handleManagerSummary('notifications');
    });

    window.addEventListener('activitiesUpdated', () => {
        if (!state.ready) return;
        handleManagerSummary('activities');
    });
}

async function boot() {
    state.currentDays = 7;
    state.currentRealtimeDateRange = { start: null, end: null };
    syncTopVendorDateInputs();
    setTopVendorRangeButtons(state.currentDays);
    setTopVendorFiltersVisible(false);
    setActiveButtonGroup('#liveFilterButtons .live-filter-btn', 'liveFilter', state.feedFilter);
    setActiveButtonGroup('#liveWindowButtons .live-window-btn', 'liveWindow', String(state.feedWindowMinutes));
    setLiveWindowLabel();
    updateLiveCaption();

    // Immediately replace static skeleton HTML with real content so
    // they don't get stuck even before async ops complete.
    const presenceCountLine = $id('presenceCountLine');
    if (presenceCountLine) presenceCountLine.textContent = 'En connexion...';
    const livePresenceList = $id('livePresenceList');
    if (livePresenceList) livePresenceList.innerHTML = `<div class="text-xs text-gray-400 italic">Connexion au canal de présence...</div>`;

    updateChannelHealth();

    const meta = $id('realtimeMeta');
    if (meta) meta.textContent = `Fuseau: ${getLocalTimezone()} | Mise a jour: ${new Date().toLocaleString('fr-FR')}`;

    bindLocalListeners();
    renderAndSeed();
    state.ready = true;
    renderFeed();
    updateMetrics();
    updateChannelHealth();

    await seedAnalyticsSnapshot();
    await seedIncidentSnapshot();
    await setupRealtimeMonitor();

    // Ensure OrderManager is ready before rendering Top Vendors.
    // If already initialized — render now. Otherwise kick off init and
    // renderTopVendors will fire again via the ordersUpdated listener.
    if (window.OrderManager && window.OrderManager._initialized && !window.OrderManager._fetchPromise) {
        await renderTopVendors({ days: state.currentDays });
    } else if (window.OrderManager && !window.OrderManager._initialized && !window.OrderManager._fetchPromise) {
        // Show skeleton while we wait for init to complete
        renderTopVendorsSkeleton();
        window.OrderManager.init({ force: false }).catch(() => {});
        // ordersUpdated listener (bindLocalListeners) will call renderTopVendors when done
    } else {
        // Fallback — try to render with whatever data is available
        await renderTopVendors({ days: state.currentDays });
    }

    // Safety net: retry channel health and top vendors after short delays
    // to handle the case where managers finish after boot() runs.
    [500, 1200, 2500].forEach((delay) => {
        window.setTimeout(() => {
            updateChannelHealth();
            if (window.OrderManager?._initialized) {
                renderTopVendors({ days: state.currentDays, range: state.currentRealtimeDateRange }).catch(() => {});
            }
        }, delay);
    });

    const refreshBtn = $id('liveRefreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            setStatusPill('Actualisation', 'warn');
            await refreshManagers(true);
            renderAndSeed();
            await renderTopVendors({ days: state.currentDays, range: state.currentRealtimeDateRange });
            setStatusPill('Live', 'good');
        });
    }

    const exportBtn = $id('liveExportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportFeedSnapshot();
        });
    }

    const pauseBtn = $id('livePauseBtn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            state.paused = !state.paused;
            pauseBtn.textContent = state.paused ? 'Reprendre' : 'Pause';
            if (!state.paused) renderFeed();
            updateMetrics();
        });
    }

    const searchInput = $id('liveSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            state.feedSearch = searchInput.value.trim();
            renderFeed();
            updateMetrics();
        });
    }

    document.querySelectorAll('.live-filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.feedFilter = btn.dataset.liveFilter || 'all';
            setActiveButtonGroup('#liveFilterButtons .live-filter-btn', 'liveFilter', state.feedFilter);
            renderFeed();
            updateMetrics();
        });
    });

    document.querySelectorAll('.live-window-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.feedWindowMinutes = Number(btn.dataset.liveWindow) || 0;
            setActiveButtonGroup('#liveWindowButtons .live-window-btn', 'liveWindow', String(state.feedWindowMinutes));
            setLiveWindowLabel();
            renderFeed();
            updateMetrics();
        });
    });

    const reconnectBtn = $id('reconnectRealtimeBtn');
    if (reconnectBtn) {
        reconnectBtn.addEventListener('click', async () => {
            setStatusPill('Reconnecte', 'warn');
            await setupRealtimeMonitor();
            renderFeed();
            updateMetrics();
            updateChannelHealth();
        });
    }

    document.querySelectorAll('.rt-range-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.currentDays = Number(btn.dataset.days) || 7;
            state.currentRealtimeDateRange = { start: null, end: null };
            syncTopVendorDateInputs();
            setTopVendorRangeButtons(state.currentDays);
            setTopVendorFiltersVisible(false);
            renderTopVendors({ days: state.currentDays }).catch(() => {});
        });
    });

    const toggleFiltersBtn = $id('toggleRealtimeDateFiltersBtn');
    if (toggleFiltersBtn) toggleFiltersBtn.addEventListener('click', toggleTopVendorFilters);

    const applyBtn = $id('applyRealtimeDateBtn');
    if (applyBtn) applyBtn.addEventListener('click', applyTopVendorDateRange);

    const clearBtn = $id('clearRealtimeDateBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearTopVendorDateRange);
}

function waitForReady() {
    if (window.newketInitialized) {
        boot().catch((err) => console.error('[Admin realtime] boot error:', err));
        return;
    }
    window.addEventListener('newketInitialized', () => {
        boot().catch((err) => console.error('[Admin realtime] boot error:', err));
    }, { once: true });
}

window.addEventListener('beforeunload', cleanupRealtimeChannels);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForReady);
} else {
    waitForReady();
}
