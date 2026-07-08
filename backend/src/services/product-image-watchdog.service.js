import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import NotificationService from './notificationService.js';

const DEFAULT_BATCH_SIZE = 25;
const HEALTHY_RECHECK_MS = 12 * 60 * 60 * 1000;
const BROKEN_RECHECK_MS = 60 * 60 * 1000;
const BOOTSTRAP_BATCH_SIZE = 200;

function nowIso() {
    return new Date().toISOString();
}

function addMs(ms) {
    return new Date(Date.now() + ms).toISOString();
}

function fingerprint(value) {
    return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 16);
}

function getPrimaryImageToken(rawImage) {
    if (Array.isArray(rawImage)) {
        return rawImage.find((entry) => typeof entry === 'string' && entry.trim())?.trim() || '';
    }

    if (typeof rawImage !== 'string') return '';

    return rawImage
        .split('||')[0]
        .split(',')
        .map((part) => part.trim())
        .find(Boolean) || '';
}

function normalizeImageUrl(rawImage) {
    const token = getPrimaryImageToken(rawImage);
    if (!token) return '';

    if (/^https?:\/\//i.test(token) || /^data:image\//i.test(token)) {
        return token;
    }

    if (token.startsWith('//')) {
        return `https:${token}`;
    }

    return token;
}

function isMissingWatchdogTableError(error) {
    const message = String(error?.message || '');
    return message.includes('relation "public.product_image_watchdog" does not exist')
        || message.includes('Could not find the table');
}

async function fetchWithTimeout(url, options = {}) {
    const timeoutMs = options.timeoutMs || 8000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

    try {
        return await fetch(url, {
            method: options.method || 'HEAD',
            redirect: 'follow',
            signal: controller.signal,
            headers: options.headers || {}
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function probeImageUrl(url) {
    if (!url) return { ok: false, reason: 'missing image' };

    if (url.startsWith('data:image/')) {
        return { ok: true, reason: 'data url' };
    }

    if (!/^https?:\/\//i.test(url)) {
        return { ok: false, reason: 'unsupported image url' };
    }

    try {
        let response = await fetchWithTimeout(url, { method: 'HEAD' });
        const contentType = response.headers.get('content-type') || '';

        if (response.ok && (!contentType || contentType.includes('image/'))) {
            return { ok: true, status: response.status, contentType };
        }

        if ([403, 405, 501].includes(response.status) || !response.ok) {
            response = await fetchWithTimeout(url, {
                method: 'GET',
                headers: { Range: 'bytes=0-0' }
            });

            const rangeContentType = response.headers.get('content-type') || '';
            if (response.ok && (!rangeContentType || rangeContentType.includes('image/'))) {
                return { ok: true, status: response.status, contentType: rangeContentType };
            }
        }

        return {
            ok: false,
            reason: `HTTP ${response.status}`
        };
    } catch (error) {
        return {
            ok: false,
            reason: error?.message || String(error)
        };
    }
}

async function ensureBootstrapStates() {
    const { count, error } = await supabaseAdmin
        .from('product_image_watchdog')
        .select('id', { count: 'exact', head: true });

    if (error) {
        if (isMissingWatchdogTableError(error)) {
            return { bootstrapped: false, missingTable: true };
        }
        throw error;
    }

    if ((count || 0) > 0) {
        return { bootstrapped: false, missingTable: false };
    }

    let offset = 0;
    let seeded = 0;

    while (true) {
        const { data: products, error: productsError } = await supabaseAdmin
            .from('products')
            .select('id, name, image, supplier_email, user_id, is_archived')
            .eq('is_archived', false)
            .order('updated_at', { ascending: false })
            .range(offset, offset + BOOTSTRAP_BATCH_SIZE - 1);

        if (productsError) throw productsError;
        if (!products || products.length === 0) break;

        const rows = products
            .filter((product) => normalizeImageUrl(product.image))
            .map((product) => {
                const imageUrl = normalizeImageUrl(product.image);
                return {
                    product_id: product.id,
                    image_signature: fingerprint(imageUrl),
                    image_url: imageUrl,
                    status: 'unknown',
                    failure_count: 0,
                    last_error: null,
                    last_checked_at: null,
                    last_notified_at: null,
                    next_check_at: nowIso(),
                    updated_at: nowIso()
                };
            });

        if (rows.length > 0) {
            const { error: upsertError } = await supabaseAdmin
                .from('product_image_watchdog')
                .upsert(rows, { onConflict: 'product_id' });
            if (upsertError) throw upsertError;
            seeded += rows.length;
        }

        offset += products.length;
        if (products.length < BOOTSTRAP_BATCH_SIZE) break;
    }

    return { bootstrapped: seeded > 0, missingTable: false, seeded };
}

async function upsertState(patch) {
    try {
        const { error } = await supabaseAdmin
            .from('product_image_watchdog')
            .upsert({
                ...patch,
                updated_at: nowIso()
            }, { onConflict: 'product_id' });

        if (error) throw error;
    } catch (error) {
        if (isMissingWatchdogTableError(error)) return null;
        throw error;
    }
}

async function syncWatchdogStatesFromProducts() {
    const { data: existingStates, error: existingError } = await supabaseAdmin
        .from('product_image_watchdog')
        .select('product_id, image_signature, last_notified_at');

    if (existingError) {
        if (isMissingWatchdogTableError(existingError)) {
            return { synced: 0, missingTable: true };
        }
        throw existingError;
    }

    const existingById = new Map((existingStates || []).map((row) => [row.product_id, row]));
    let offset = 0;
    let synced = 0;

    while (true) {
        const { data: products, error: productsError } = await supabaseAdmin
            .from('products')
            .select('id, name, image, supplier_email, user_id, is_archived')
            .eq('is_archived', false)
            .order('updated_at', { ascending: false })
            .range(offset, offset + BOOTSTRAP_BATCH_SIZE - 1);

        if (productsError) throw productsError;
        if (!products || products.length === 0) break;

        const rows = [];
        for (const product of products) {
            const imageUrl = normalizeImageUrl(product.image);
            const imageSignature = fingerprint(imageUrl || `missing:${product.id}`);
            const existing = existingById.get(product.id);
            if (existing && existing.image_signature === imageSignature) continue;

            rows.push({
                product_id: product.id,
                image_signature: imageSignature,
                image_url: imageUrl,
                status: existing?.status === 'broken' && existing.image_signature === imageSignature ? 'broken' : 'unknown',
                failure_count: existing?.image_signature === imageSignature ? (existing.failure_count || 0) : 0,
                last_error: existing?.image_signature === imageSignature ? null : null,
                last_checked_at: existing?.image_signature === imageSignature ? null : null,
                last_notified_at: existing?.image_signature === imageSignature ? existing.last_notified_at || null : null,
                next_check_at: nowIso(),
                updated_at: nowIso()
            });
        }

        if (rows.length > 0) {
            const { error: upsertError } = await supabaseAdmin
                .from('product_image_watchdog')
                .upsert(rows, { onConflict: 'product_id' });
            if (upsertError) throw upsertError;
            synced += rows.length;
        }

        offset += products.length;
        if (products.length < BOOTSTRAP_BATCH_SIZE) break;
    }

    return { synced, missingTable: false };
}

async function fetchDueWatchdogRows(limit = DEFAULT_BATCH_SIZE) {
    try {
        const { data, error } = await supabaseAdmin
            .from('product_image_watchdog')
            .select('product_id, image_signature, image_url, status, failure_count, last_error, last_checked_at, last_notified_at, next_check_at')
            .lte('next_check_at', nowIso())
            .order('next_check_at', { ascending: true })
            .limit(limit);

        if (error) throw error;
        return Array.isArray(data) ? data : [];
    } catch (error) {
        if (isMissingWatchdogTableError(error)) return [];
        throw error;
    }
}

async function fetchProductsByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const { data, error } = await supabaseAdmin
        .from('products')
        .select('id, name, image, supplier_email, user_id, is_archived')
        .in('id', ids);

    if (error) throw error;
    return Array.isArray(data) ? data : [];
}

async function processOneProduct(product, state = null) {
    if (!product?.id) return { status: 'skipped' };

    const imageUrl = normalizeImageUrl(product.image);
    const imageSignature = fingerprint(imageUrl || `missing:${product.id}`);
    const checkedAt = nowIso();

    if (!imageUrl) {
        const nextCheckAt = addMs(BROKEN_RECHECK_MS);
        await upsertState({
            product_id: product.id,
            image_signature: imageSignature,
            image_url: '',
            status: 'broken',
            failure_count: (state?.failure_count || 0) + 1,
            last_error: 'missing image',
            last_checked_at: checkedAt,
            last_notified_at: state?.last_notified_at || null,
            next_check_at: nextCheckAt
        });

        const shouldNotify = !state || state.status !== 'broken' || state.image_signature !== imageSignature || !state.last_notified_at;
        if (shouldNotify) {
            const notified = await NotificationService.notifyVendorProductImageIssue(product, {
                reason: 'missing image',
                detail: 'aucune image exploitable',
                signature: imageSignature
            });

            if (notified) {
                await upsertState({
                    product_id: product.id,
                    image_signature: imageSignature,
                    image_url: '',
                    status: 'broken',
                    failure_count: (state?.failure_count || 0) + 1,
                    last_error: 'missing image',
                    last_checked_at: checkedAt,
                    last_notified_at: checkedAt,
                    next_check_at: nextCheckAt
                });
            }
        }

        return { status: 'broken', reason: 'missing image' };
    }

    const probe = await probeImageUrl(imageUrl);
    if (probe.ok) {
        const nextCheckAt = addMs(HEALTHY_RECHECK_MS);
        await upsertState({
            product_id: product.id,
            image_signature: imageSignature,
            image_url: imageUrl,
            status: 'ok',
            failure_count: 0,
            last_error: null,
            last_checked_at: checkedAt,
            last_notified_at: state?.last_notified_at || null,
            next_check_at: nextCheckAt
        });

        return { status: 'ok' };
    }

    const nextCheckAt = addMs(BROKEN_RECHECK_MS);
    await upsertState({
        product_id: product.id,
        image_signature: imageSignature,
        image_url: imageUrl,
        status: 'broken',
        failure_count: (state?.failure_count || 0) + 1,
        last_error: probe.reason || 'image check failed',
        last_checked_at: checkedAt,
        last_notified_at: state?.last_notified_at || null,
        next_check_at: nextCheckAt
    });

    const shouldNotify = !state || state.status !== 'broken' || state.image_signature !== imageSignature || !state.last_notified_at;
    if (shouldNotify) {
        const notified = await NotificationService.notifyVendorProductImageIssue(product, {
            reason: probe.reason || 'image check failed',
            detail: imageUrl,
            signature: imageSignature
        });

        if (notified) {
            await upsertState({
                product_id: product.id,
                image_signature: imageSignature,
                image_url: imageUrl,
                status: 'broken',
                failure_count: (state?.failure_count || 0) + 1,
                last_error: probe.reason || 'image check failed',
                last_checked_at: checkedAt,
                last_notified_at: checkedAt,
                next_check_at: nextCheckAt
            });
        }
    }

    return {
        status: 'broken',
        reason: probe.reason || 'image check failed'
    };
}

export async function auditProductImageNow(product) {
    if (!product?.id) return { status: 'skipped' };

    const imageUrl = normalizeImageUrl(product.image);
    const imageSignature = fingerprint(imageUrl || `missing:${product.id}`);

    let state = null;
    try {
        const result = await supabaseAdmin
            .from('product_image_watchdog')
            .select('product_id, image_signature, image_url, status, failure_count, last_error, last_checked_at, last_notified_at, next_check_at')
            .eq('product_id', product.id)
            .maybeSingle();
        state = result.data;
    } catch (error) {
        if (isMissingWatchdogTableError(error)) {
            return { status: 'skipped', reason: 'watchdog table missing' };
        }
        throw error;
    }

    return processOneProduct(product, state || {
        product_id: product.id,
        image_signature: imageSignature,
        image_url: imageUrl,
        status: 'unknown',
        failure_count: 0,
        last_error: null,
        last_checked_at: null,
        last_notified_at: null,
        next_check_at: nowIso()
    });
}

export async function ensureProductImageWatchdogState(product) {
    if (!product?.id) return null;

    const imageUrl = normalizeImageUrl(product.image);
    const imageSignature = fingerprint(imageUrl || `missing:${product.id}`);

    await upsertState({
        product_id: product.id,
        image_signature: imageSignature,
        image_url: imageUrl,
        status: 'unknown',
        failure_count: 0,
        last_error: null,
        last_checked_at: null,
        last_notified_at: null,
        next_check_at: nowIso()
    });

    return true;
}

export async function processProductImageWatchdogJob({ batchSize = DEFAULT_BATCH_SIZE } = {}) {
    const sync = await syncWatchdogStatesFromProducts();
    if (sync.missingTable) {
        return {
            bootstrapped: false,
            seeded: 0,
            checked: 0,
            ok: 0,
            broken: 0,
            skipped: 0,
            synced: 0,
            disabled: true,
            ran_at: nowIso()
        };
    }

    const summary = {
        bootstrapped: false,
        seeded: 0,
        synced: sync.synced || 0,
        checked: 0,
        ok: 0,
        broken: 0,
        skipped: 0
    };

    let processed = 0;
    while (processed < batchSize) {
        const dueRows = await fetchDueWatchdogRows(batchSize - processed);
        if (dueRows.length === 0) break;

        const products = await fetchProductsByIds(dueRows.map((row) => row.product_id));
        const byId = new Map(products.map((product) => [product.id, product]));

        for (const row of dueRows) {
            const product = byId.get(row.product_id);
            if (!product || product.is_archived) {
                summary.skipped += 1;
                processed += 1;
                continue;
            }

            const result = await processOneProduct(product, row);
            summary.checked += 1;
            if (result.status === 'ok') summary.ok += 1;
            else if (result.status === 'broken') summary.broken += 1;
            else summary.skipped += 1;
            processed += 1;
        }
    }

    return {
        ...summary,
        ran_at: nowIso()
    };
}
