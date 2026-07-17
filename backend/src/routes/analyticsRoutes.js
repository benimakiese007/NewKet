import express from 'express';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import { supabaseAdmin } from '../config/supabase.js';
dotenv.config();

const router = express.Router();

// Rate limiter strict pour les analytics
// Limite a 20 increments par IP par 15 minutes pour empecher le spam de vues
const analyticsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Trop de requetes analytics. Reessayez plus tard.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const supabase = supabaseAdmin;

// Validation UUID simple pour eviter les injections via IDs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Validation ID produit (UUID ou format prod-timestamp)
const PRODUCT_ID_REGEX = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|prod-[a-z0-9-]+)$/i;

function isValidUuid(value) {
    return typeof value === 'string' && UUID_REGEX.test(value);
}

function isValidProductId(value) {
    return typeof value === 'string' && PRODUCT_ID_REGEX.test(value);
}

function getClientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
        return xff.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || '';
}

function hashIp(ip) {
    if (!ip) return null;
    const salt = process.env.ANALYTICS_IP_SALT || '';
    return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function sanitizeText(value, max = 255) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, max);
}

function sanitizePath(value) {
    const path = sanitizeText(value, 512);
    if (!path) return '/';
    return path.startsWith('/') ? path : `/${path}`;
}

function sanitizeMetadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const entries = Object.entries(value).slice(0, 20).map(([key, raw]) => {
        const safeKey = String(key).slice(0, 64);
        if (raw == null) return [safeKey, null];
        if (typeof raw === 'number' || typeof raw === 'boolean') return [safeKey, raw];
        return [safeKey, String(raw).slice(0, 500)];
    });
    return Object.fromEntries(entries);
}

function getRecentDayLabel(dateLike) {
    const d = new Date(dateLike);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function clampInt(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function parseCsvList(value, maxItems = 10) {
    if (typeof value !== 'string') return [];
    return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, maxItems);
}

function isValidIsoDate(value) {
    if (typeof value !== 'string') return false;
    const d = new Date(value);
    return !Number.isNaN(d.getTime());
}

function toIso(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString();
}

function parsePeriod(req) {
    const maxDays = 90;
    const days = clampInt(req.query.days, 1, maxDays, 7);

    const startParam = req.query.start;
    const endParam = req.query.end;

    const now = new Date();
    const hasStart = isValidIsoDate(startParam);
    const hasEnd = isValidIsoDate(endParam);

    // Exclusive end bound
    const end = hasEnd ? new Date(endParam) : now;
    const start = hasStart ? new Date(startParam) : new Date(end.getTime() - (days * 24 * 60 * 60 * 1000));

    // Clamp to avoid accidental huge scans
    const maxRangeMs = maxDays * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxRangeMs) {
        const clampedStart = new Date(end.getTime() - maxRangeMs);
        return { start: clampedStart, end, days: maxDays, mode: hasStart || hasEnd ? 'custom' : 'days' };
    }

    const effectiveDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
    return { start, end, days: Math.min(maxDays, effectiveDays), mode: hasStart || hasEnd ? 'custom' : 'days' };
}

function parseBehaviorFilters(req) {
    const allowedTypes = new Set(['page_view', 'click', 'heartbeat', 'admin_action']);
    const eventTypes = parseCsvList(req.query.event_types, 8).filter((t) => allowedTypes.has(t));

    const role = sanitizeText(req.query.role, 32);
    const device = sanitizeText(req.query.device, 16);
    const auth = sanitizeText(req.query.auth, 16); // authenticated | guest | all
    const includeAdmin = String(req.query.include_admin || '').trim() === '1';
    const userId = sanitizeText(req.query.user_id, 64);

    const pathContains = sanitizeText(req.query.path_contains, 180);
    const targetContains = sanitizeText(req.query.target_contains, 180);

    return {
        eventTypes,
        role: role && role !== 'all' ? role : null,
        device: device && device !== 'all' ? device : null,
        auth: auth && auth !== 'all' ? auth : null,
        includeAdmin,
        userId: isValidUuid(userId) ? userId : null,
        pathContains,
        targetContains,
    };
}

function applyBehaviorFilters(query, filters) {
    if (!filters) return query;

    if (Array.isArray(filters.eventTypes) && filters.eventTypes.length) {
        query = query.in('event_type', filters.eventTypes);
    }

    if (filters.role) {
        query = query.eq('user_role', filters.role);
    }

    if (filters.device) {
        // Stored as metadata.device (string)
        query = query.eq('metadata->>device', filters.device);
    }

    if (filters.auth === 'authenticated') {
        query = query.not('user_id', 'is', null);
    } else if (filters.auth === 'guest') {
        query = query.is('user_id', null);
    }

    if (filters.userId) {
        query = query.eq('user_id', filters.userId);
    }

    if (filters.pathContains) {
        query = query.ilike('path', `%${filters.pathContains}%`);
    }

    if (filters.targetContains) {
        query = query.ilike('target', `%${filters.targetContains}%`);
    }

    // By default, do NOT count admin dashboard behavior in user behavior analytics.
    // Can be overridden with include_admin=1 for debugging.
    if (!filters.includeAdmin) {
        query = query.neq('user_role', 'admin');
        query = query.not('path', 'ilike', '%/src/pages/admin/%');
    }

    return query;
}

function computeBehaviorOverview(rows, { includeTop = true } = {}) {
    const safeRows = Array.isArray(rows) ? rows : [];

    const pageViews = [];
    const clicks = [];
    const heartbeats = [];
    const adminActions = [];

    const uniqueUsers = new Set();
    const uniqueSessions = new Set();

    let totalActiveMs = 0;

    const pageCounts = new Map();
    const pageTitleCounts = new Map(); // path -> Map(title -> count)
    const targetCounts = new Map();
    const roleCounts = new Map();
    const deviceCounts = new Map();
    const authCounts = new Map();
    const dailyCountsMap = new Map(); // day -> { page_views, clicks, admin_actions, heartbeats, active_ms }

    const quality = {
        total_rows: safeRows.length,
        missing_session_id: 0,
        missing_user_id: 0,
        missing_user_role: 0,
        missing_metadata_device: 0,
        missing_path: 0,
        missing_target: 0,
    };

    safeRows.forEach((row) => {
        const eventType = row.event_type;
        if (eventType === 'page_view') pageViews.push(row);
        else if (eventType === 'click') clicks.push(row);
        else if (eventType === 'heartbeat') heartbeats.push(row);
        else if (eventType === 'admin_action') adminActions.push(row);

        if (!row.session_id) quality.missing_session_id += 1;
        if (!row.user_id) quality.missing_user_id += 1;
        if (!row.user_role) quality.missing_user_role += 1;
        if (!row.path) quality.missing_path += 1;
        if (!row.target && (eventType === 'click' || eventType === 'admin_action')) quality.missing_target += 1;

        const device = row.metadata?.device || null;
        if (!device) quality.missing_metadata_device += 1;

        if (row.user_id) uniqueUsers.add(row.user_id);
        if (row.session_id) uniqueSessions.add(row.session_id);

        const roleKey = row.user_role || 'guest';
        roleCounts.set(roleKey, (roleCounts.get(roleKey) || 0) + 1);

        const deviceKey = device || 'unknown';
        deviceCounts.set(deviceKey, (deviceCounts.get(deviceKey) || 0) + 1);

        const authKey = row.user_id ? 'authenticated' : 'guest';
        authCounts.set(authKey, (authCounts.get(authKey) || 0) + 1);

        if (row.path) {
            pageCounts.set(row.path, (pageCounts.get(row.path) || 0) + 1);

            const title = row.page_title || null;
            if (title) {
                const titleMap = pageTitleCounts.get(row.path) || new Map();
                titleMap.set(title, (titleMap.get(title) || 0) + 1);
                pageTitleCounts.set(row.path, titleMap);
            }
        }

        if (row.target) targetCounts.set(row.target, (targetCounts.get(row.target) || 0) + 1);

        if (eventType === 'heartbeat') {
            totalActiveMs += Number(row.active_ms) || 0;
        }

        const day = getRecentDayLabel(row.created_at);
        if (day) {
            const existing = dailyCountsMap.get(day) || { day, page_views: 0, clicks: 0, admin_actions: 0, heartbeats: 0, active_ms: 0 };
            if (eventType === 'page_view') existing.page_views += 1;
            else if (eventType === 'click') existing.clicks += 1;
            else if (eventType === 'admin_action') existing.admin_actions += 1;
            else if (eventType === 'heartbeat') {
                existing.heartbeats += 1;
                existing.active_ms += Number(row.active_ms) || 0;
            }
            dailyCountsMap.set(day, existing);
        }
    });

    const summary = {
        total_events: safeRows.length,
        page_views: pageViews.length,
        clicks: clicks.length,
        admin_actions: adminActions.length,
        unique_users: uniqueUsers.size,
        unique_sessions: uniqueSessions.size,
        total_active_ms: totalActiveMs,
    };

    const timeseries = Array.from(dailyCountsMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, dayRow]) => dayRow);

    const pickMostCommonTitle = (path) => {
        const titleMap = pageTitleCounts.get(path);
        if (!titleMap) return null;
        let best = null;
        let bestCount = 0;
        for (const [title, count] of titleMap.entries()) {
            if (count > bestCount) {
                bestCount = count;
                best = title;
            }
        }
        return best;
    };

    const top_pages = includeTop
        ? Array.from(pageCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([path, count]) => ({ path, count, title: pickMostCommonTitle(path) }))
        : [];

    const top_targets = includeTop
        ? Array.from(targetCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([target, count]) => ({ target, count }))
        : [];

    const role_breakdown = Array.from(roleCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([role, count]) => ({ role, count }));

    const device_breakdown = Array.from(deviceCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([device, count]) => ({ device, count }));

    const auth_breakdown = Array.from(authCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([auth, count]) => ({ auth, count }));

    const daily_page_views = timeseries.map((row) => ({ day: row.day, count: row.page_views }));

    return {
        summary,
        top_pages,
        top_targets,
        role_breakdown,
        device_breakdown,
        auth_breakdown,
        timeseries,
        daily_page_views,
        data_quality: quality,
    };
}

function computeDelta(currentSummary, previousSummary) {
    const keys = ['total_events', 'page_views', 'clicks', 'admin_actions', 'unique_users', 'unique_sessions', 'total_active_ms'];
    const delta = {};

    keys.forEach((key) => {
        const current = Number(currentSummary?.[key] || 0);
        const previous = Number(previousSummary?.[key] || 0);
        const abs = current - previous;
        const pct = previous ? (abs / previous) * 100 : null;
        delta[key] = { current, previous, abs, pct };
    });

    return delta;
}

function computeFunnel(rows, funnelId = 'default') {
    const safeRows = Array.isArray(rows) ? rows : [];
    const stepsById = {
        default: [
            { id: 'discover', label: 'Découverte', match: (p) => /\/(shop|shops|catalog)\.html\b/i.test(p || '') },
            { id: 'product', label: 'Produit', match: (p) => /\/product\.html\b/i.test(p || '') },
            { id: 'achat', label: 'Achat', match: (p) => /\/achat\.html\b/i.test(p || '') },
            { id: 'success', label: 'Succès', match: (p) => /\/payment-success\.html\b/i.test(p || '') },
        ],
        admin: [
            { id: 'admin_enter', label: 'Entrée admin', match: (p) => /\/src\/pages\/admin\/index\.html\b/i.test(p || '') },
            { id: 'admin_orders', label: 'Commandes', match: (p) => /view=orders\b/i.test(p || '') || /\/src\/pages\/admin\/orders\.html\b/i.test(p || '') },
            { id: 'admin_products', label: 'Catalogue', match: (p) => /view=products\b/i.test(p || '') || /\/src\/pages\/admin\/products\.html\b/i.test(p || '') },
            { id: 'admin_analytics', label: 'Comportements', match: (p) => /view=analytics\b/i.test(p || '') || /\/src\/pages\/admin\/analytics\.html\b/i.test(p || '') },
        ],
    };

    const steps = stepsById[funnelId] || stepsById.default;

    const sessions = new Map(); // session_id -> array of paths
    safeRows
        .filter((row) => row.event_type === 'page_view' && row.session_id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .forEach((row) => {
            const key = row.session_id;
            const list = sessions.get(key) || [];
            list.push(row.path || '');
            sessions.set(key, list);
        });

    const totals = steps.map(() => 0);
    const sessionCount = sessions.size;

    for (const [, paths] of sessions.entries()) {
        let idx = 0;
        for (const path of paths) {
            if (idx >= steps.length) break;
            if (steps[idx].match(path)) {
                totals[idx] += 1;
                idx += 1;
            }
        }
    }

    return {
        id: funnelId,
        sessions: sessionCount,
        steps: steps.map((s, i) => ({
            id: s.id,
            label: s.label,
            sessions: totals[i],
            rate: sessionCount ? (totals[i] / sessionCount) * 100 : 0,
        })),
    };
}

/**
 * Increment product view count
 * POST /api/analytics/view/:productId
 */
router.post('/view/:productId', analyticsLimiter, async (req, res) => {
    const { productId } = req.params;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required.' });
    }

    if (!isValidProductId(productId)) {
        return res.status(400).json({ error: 'Product ID invalide.' });
    }

    try {
        const { error } = await supabase.rpc('increment_product_views', { product_id: productId });
        if (error) throw error;
        return res.json({ success: true, message: 'View counted.' });
    } catch (error) {
        console.error(`[Analytics] Error counting view for ${productId}:`, error);
        return res.status(500).json({ error: 'Failed to count view.' });
    }
});

/**
 * Record a shop view event
 * POST /api/analytics/shop-view
 * body: { vendor_id: uuid, session_id?: string }
 */
router.post('/shop-view', analyticsLimiter, async (req, res) => {
    const vendorId = req.body?.vendor_id;
    const sessionId = req.body?.session_id;

    if (!isValidUuid(vendorId)) {
        return res.status(400).json({ error: 'vendor_id invalide.' });
    }

    const viewerUserId = req.user?.id && isValidUuid(req.user.id) ? req.user.id : null;
    const safeSessionId = typeof sessionId === 'string' && sessionId.length <= 128 ? sessionId : null;
    const ipHash = hashIp(getClientIp(req));
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : null;

    try {
        // Dedupe simple: max 1 event / vendor / session (or viewer user) / day (UTC)
        const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const dayStart = `${dayKey}T00:00:00.000Z`;
        const dayEnd = `${dayKey}T23:59:59.999Z`;

        if (viewerUserId) {
            const { data: existing, error: existingError } = await supabase
                .from('shop_views')
                .select('id')
                .eq('vendor_id', vendorId)
                .eq('viewer_user_id', viewerUserId)
                .gte('created_at', dayStart)
                .lt('created_at', dayEnd)
                .limit(1);

            if (existingError) throw existingError;
            if (existing?.length) return res.json({ success: true, deduped: true });
        } else if (safeSessionId) {
            const { data: existing, error: existingError } = await supabase
                .from('shop_views')
                .select('id')
                .eq('vendor_id', vendorId)
                .eq('session_id', safeSessionId)
                .gte('created_at', dayStart)
                .lt('created_at', dayEnd)
                .limit(1);

            if (existingError) throw existingError;
            if (existing?.length) return res.json({ success: true, deduped: true });
        }

        const { error } = await supabase
            .from('shop_views')
            .insert({
                vendor_id: vendorId,
                viewer_user_id: viewerUserId,
                session_id: safeSessionId,
                ip_hash: ipHash,
                user_agent: userAgent,
            });

        if (error) throw error;
        return res.json({ success: true });
    } catch (error) {
        console.error('[Analytics] Error recording shop view:', error);
        return res.status(500).json({ error: 'Failed to record shop view.' });
    }
});

router.post('/events', analyticsLimiter, async (req, res) => {
    const allowedTypes = new Set(['page_view', 'click', 'heartbeat', 'admin_action']);
    const eventType = sanitizeText(req.body?.event_type, 32);

    if (!eventType || !allowedTypes.has(eventType)) {
        return res.status(400).json({ error: 'event_type invalide.' });
    }

    const activeMsRaw = Number(req.body?.active_ms);
    const activeMs = Number.isFinite(activeMsRaw)
        ? Math.max(0, Math.min(60 * 60 * 1000, Math.round(activeMsRaw)))
        : null;

    try {
        const { error } = await supabase
            .from('analytics_events')
            .insert({
                event_type: eventType,
                user_id: req.user?.id && isValidUuid(req.user.id) ? req.user.id : null,
                user_role: sanitizeText(req.user?.app_metadata?.role || req.user?.user_metadata?.role || req.body?.user_role, 32),
                session_id: sanitizeText(req.body?.session_id, 128),
                path: sanitizePath(req.body?.path),
                page_title: sanitizeText(req.body?.page_title, 180),
                target: sanitizeText(req.body?.target, 180),
                active_ms: activeMs,
                metadata: sanitizeMetadata(req.body?.metadata),
                ip_hash: hashIp(getClientIp(req)),
                user_agent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : null,
            });

        if (error) throw error;
        return res.json({ success: true });
    } catch (error) {
        console.error('[Analytics] Error recording event:', error);
        return res.status(500).json({ error: 'Failed to record analytics event.' });
    }
});

/**
 * Vendor shop metrics
 * GET /api/analytics/vendor/shop-metrics?days=30
 */
router.get('/vendor/shop-metrics', async (req, res) => {
    const vendorId = req.user?.id;
    if (!isValidUuid(vendorId)) {
        return res.status(401).json({ error: 'Non autorise.' });
    }

    const days = Math.max(1, Math.min(90, parseInt(req.query.days, 10) || 30));
    const sinceIso = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();

    try {
        const { data, error } = await supabase
            .from('shop_views')
            .select('viewer_user_id, session_id, ip_hash, created_at')
            .eq('vendor_id', vendorId)
            .gte('created_at', sinceIso);

        if (error) throw error;

        const rows = data || [];
        const totalViews = rows.length;
        const uniqueAccounts = new Set(rows.map((r) => r.viewer_user_id).filter(Boolean)).size;
        const uniqueVisitors = new Set(
            rows
                .map((r) => String(r.viewer_user_id || r.session_id || r.ip_hash || ''))
                .filter((v) => v && v !== 'null' && v !== 'undefined')
        ).size;

        return res.json({
            success: true,
            days,
            total_views: totalViews,
            unique_accounts: uniqueAccounts,
            unique_visitors: uniqueVisitors,
        });
    } catch (error) {
        console.error('[Analytics] Error fetching shop metrics:', error);
        return res.status(500).json({ error: 'Failed to fetch shop metrics.' });
    }
});

router.get('/admin/behavior', requireAuth, requireAdmin, async (req, res) => {
    const period = parsePeriod(req);
    const limit = clampInt(req.query.limit, 20, 500, 120);
    const filters = parseBehaviorFilters(req);
    const funnelId = sanitizeText(req.query.funnel, 16) || 'default';

    try {
        const baseSelect = 'id, event_type, user_id, user_role, session_id, path, page_title, target, active_ms, metadata, created_at';
        const maxRows = clampInt(req.query.max_rows, 1000, 20000, 8000);

        let currentQuery = supabase
            .from('analytics_events')
            .select(baseSelect)
            .gte('created_at', toIso(period.start))
            .lt('created_at', toIso(period.end))
            .order('created_at', { ascending: false })
            .limit(maxRows);

        currentQuery = applyBehaviorFilters(currentQuery, filters);

        const { data: currentData, error: currentError } = await currentQuery;

        if (currentError) throw currentError;

        const rows = currentData || [];
        const currentOverview = computeBehaviorOverview(rows, { includeTop: true });

        const previousEnd = new Date(period.start.getTime());
        const previousStart = new Date(period.start.getTime() - (period.end.getTime() - period.start.getTime()));

        let prevQuery = supabase
            .from('analytics_events')
            .select(baseSelect)
            .gte('created_at', toIso(previousStart))
            .lt('created_at', toIso(previousEnd))
            .order('created_at', { ascending: false })
            .limit(maxRows);

        prevQuery = applyBehaviorFilters(prevQuery, filters);

        const { data: prevData, error: prevError } = await prevQuery;
        if (prevError) throw prevError;

        const prevOverview = computeBehaviorOverview(prevData || [], { includeTop: false });
        const delta = computeDelta(currentOverview.summary, prevOverview.summary);

        return res.json({
            success: true,
            period: { start: toIso(period.start), end: toIso(period.end), days: period.days, mode: period.mode },
            previous_period: { start: toIso(previousStart), end: toIso(previousEnd) },
            filters,
            summary: currentOverview.summary,
            delta,
            data_quality: currentOverview.data_quality,
            timeseries: currentOverview.timeseries,
            top_pages: currentOverview.top_pages,
            top_targets: currentOverview.top_targets,
            role_breakdown: currentOverview.role_breakdown,
            device_breakdown: currentOverview.device_breakdown,
            auth_breakdown: currentOverview.auth_breakdown,
            daily_page_views: currentOverview.daily_page_views,
            funnel: computeFunnel(rows, funnelId),
            recent_events: rows.slice(0, limit),
        });
    } catch (error) {
        console.error('[Analytics] Error fetching admin behavior overview:', error);
        return res.status(500).json({ error: 'Failed to fetch behavior analytics.' });
    }
});

router.get('/admin/behavior/drilldown', requireAuth, requireAdmin, async (req, res) => {
    const period = parsePeriod(req);
    const limit = clampInt(req.query.limit, 20, 500, 120);
    const maxRows = clampInt(req.query.max_rows, 200, 20000, 6000);

    const kind = sanitizeText(req.query.kind, 16); // page | target
    const value = sanitizeText(req.query.value, 512);
    if (!kind || !value || !['page', 'target'].includes(kind)) {
        return res.status(400).json({ error: 'Parametres drilldown invalides.' });
    }

    const filters = parseBehaviorFilters(req);

    try {
        const baseSelect = 'id, event_type, user_id, user_role, session_id, path, page_title, target, active_ms, metadata, created_at';
        let query = supabase
            .from('analytics_events')
            .select(baseSelect)
            .gte('created_at', toIso(period.start))
            .lt('created_at', toIso(period.end))
            .order('created_at', { ascending: false })
            .limit(maxRows);

        query = applyBehaviorFilters(query, filters);

        if (kind === 'page') {
            query = query.eq('path', value);
        } else {
            query = query.eq('target', value);
        }

        const { data, error } = await query;
        if (error) throw error;

        const rows = data || [];
        const overview = computeBehaviorOverview(rows, { includeTop: true });

        return res.json({
            success: true,
            kind,
            value,
            period: { start: toIso(period.start), end: toIso(period.end), days: period.days, mode: period.mode },
            filters,
            summary: overview.summary,
            data_quality: overview.data_quality,
            timeseries: overview.timeseries,
            role_breakdown: overview.role_breakdown,
            device_breakdown: overview.device_breakdown,
            auth_breakdown: overview.auth_breakdown,
            recent_events: rows.slice(0, limit),
        });
    } catch (error) {
        console.error('[Analytics] Error fetching behavior drilldown:', error);
        return res.status(500).json({ error: 'Failed to fetch behavior drilldown.' });
    }
});

router.post('/admin/behavior/reset', requireAuth, requireAdmin, async (req, res) => {
    const mode = sanitizeText(req.body?.mode, 16) || 'all'; // all | period
    const period = parsePeriod({
        query: {
            days: req.body?.days,
            start: req.body?.start,
            end: req.body?.end,
        },
    });

    try {
        // Safety: cap deletes to 90 days when mode=period, otherwise allow full wipe.
        if (mode === 'period') {
            const { error } = await supabase
                .from('analytics_events')
                .delete()
                .gte('created_at', toIso(period.start))
                .lt('created_at', toIso(period.end));

            if (error) throw error;

            return res.json({
                success: true,
                deleted: 'period',
                period: { start: toIso(period.start), end: toIso(period.end), days: period.days, mode: period.mode },
            });
        }

        // mode === all
        // Use a wide created_at range instead of unfiltered delete.
        const { error } = await supabase
            .from('analytics_events')
            .delete()
            .gte('created_at', '1970-01-01T00:00:00.000Z');

        if (error) throw error;

        return res.json({ success: true, deleted: 'all' });
    } catch (error) {
        console.error('[Analytics] Error resetting behavior analytics:', error);
        return res.status(500).json({ error: 'Failed to reset behavior analytics.' });
    }
});

export default router;
