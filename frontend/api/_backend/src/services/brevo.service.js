import dotenv from 'dotenv';

dotenv.config();

const BREVO_API_BASE = 'https://api.brevo.com/v3';

function parseListIds(rawValue) {
    if (Array.isArray(rawValue)) {
        return rawValue
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0);
    }

    if (!rawValue) return [];

    return String(rawValue)
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);
}

function isConfigured() {
    return Boolean(process.env.BREVO_API_KEY);
}

async function brevoRequest(path, { method = 'POST', body } = {}) {
    if (!isConfigured()) {
        return {
            skipped: true,
            success: false,
            reason: 'BREVO_API_KEY is missing.',
        };
    }

    const response = await fetch(`${BREVO_API_BASE}${path}`, {
        method,
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            accept: 'application/json',
            'content-type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    let data = null;

    if (contentType.includes('application/json') && rawText) {
        try {
            data = JSON.parse(rawText);
        } catch {
            data = { raw: rawText };
        }
    } else if (rawText) {
        data = { raw: rawText };
    }

    if (!response.ok) {
        const error = new Error(data?.message || data?.error || `Brevo API error (${response.status})`);
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return { success: true, data };
}

export async function upsertNewsletterContact(email, { listIds = [], source = 'footer' } = {}) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const finalListIds = parseListIds(listIds || process.env.BREVO_NEWSLETTER_LIST_IDS || process.env.BREVO_NEWSLETTER_LIST_ID);

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return { success: false, skipped: true, reason: 'Invalid email address.' };
    }

    if (!isConfigured()) {
        return {
            success: false,
            skipped: true,
            reason: 'BREVO_API_KEY is missing.',
            email: normalizedEmail,
        };
    }

    const payload = {
        email: normalizedEmail,
        updateEnabled: true,
    };

    if (finalListIds.length > 0) {
        payload.listIds = finalListIds;
    }

    const result = await brevoRequest('/contacts', {
        method: 'POST',
        body: payload,
    });

    return {
        success: true,
        email: normalizedEmail,
        source,
        listIds: finalListIds,
        brevo: result.data,
    };
}

export async function blacklistNewsletterContact(email, { listIds = [] } = {}) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const finalListIds = parseListIds(listIds || process.env.BREVO_NEWSLETTER_LIST_IDS || process.env.BREVO_NEWSLETTER_LIST_ID);

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return { success: false, skipped: true, reason: 'Invalid email address.' };
    }

    const payload = {
        emailBlacklisted: true,
    };

    if (finalListIds.length > 0) {
        payload.listIds = finalListIds;
    }

    const result = await brevoRequest(`/contacts/${encodeURIComponent(normalizedEmail)}`, {
        method: 'PUT',
        body: payload,
    });

    if (finalListIds.length > 0) {
        await Promise.allSettled(finalListIds.map((listId) => brevoRequest(`/contacts/lists/${listId}/contacts/remove`, {
            method: 'POST',
            body: { emails: [normalizedEmail] },
        })));
    }

    return {
        success: true,
        email: normalizedEmail,
        listIds: finalListIds,
        brevo: result.data,
    };
}

export async function unblacklistNewsletterContact(email, { listIds = [] } = {}) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const finalListIds = parseListIds(listIds || process.env.BREVO_NEWSLETTER_LIST_IDS || process.env.BREVO_NEWSLETTER_LIST_ID);

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return { success: false, skipped: true, reason: 'Invalid email address.' };
    }

    const payload = {
        emailBlacklisted: false,
    };

    if (finalListIds.length > 0) {
        payload.listIds = finalListIds;
    }

    const result = await brevoRequest(`/contacts/${encodeURIComponent(normalizedEmail)}`, {
        method: 'PUT',
        body: payload,
    });

    if (finalListIds.length > 0) {
        await Promise.allSettled(finalListIds.map((listId) => brevoRequest(`/contacts/lists/${listId}/contacts/add`, {
            method: 'POST',
            body: { emails: [normalizedEmail] },
        })));
    }

    return {
        success: true,
        email: normalizedEmail,
        listIds: finalListIds,
        brevo: result.data,
    };
}

export async function deleteNewsletterContact(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return { success: false, skipped: true, reason: 'Invalid email address.' };
    }

    const result = await brevoRequest(`/contacts/${encodeURIComponent(normalizedEmail)}`, {
        method: 'DELETE',
    });

    return {
        success: true,
        email: normalizedEmail,
        brevo: result.data,
    };
}

export async function syncNewsletterSubscribersToBrevo(emails, { listIds = [] } = {}) {
    const finalListIds = parseListIds(listIds || process.env.BREVO_NEWSLETTER_LIST_IDS || process.env.BREVO_NEWSLETTER_LIST_ID);
    const normalizedEmails = Array.from(new Set(
        (Array.isArray(emails) ? emails : [])
            .map((email) => String(email || '').trim().toLowerCase())
            .filter((email) => email && email.includes('@'))
    ));

    const results = [];

    for (const email of normalizedEmails) {
        try {
            const result = await upsertNewsletterContact(email, { listIds: finalListIds, source: 'backfill' });
            results.push({ email, success: true, result });
        } catch (error) {
            results.push({ email, success: false, error: error.message });
        }
    }

    return {
        success: true,
        total: normalizedEmails.length,
        synced: results.filter((entry) => entry.success).length,
        failed: results.filter((entry) => !entry.success).length,
        results,
    };
}

export async function getBrevoContactsInList(listId, { listIds = [] } = {}) {
    const resolvedListId = Number(listId || process.env.BREVO_NEWSLETTER_LIST_ID);
    const finalListId = Number.isInteger(resolvedListId) && resolvedListId > 0 ? resolvedListId : null;

    if (!finalListId) {
        return {
            success: false,
            skipped: true,
            reason: 'BREVO_NEWSLETTER_LIST_ID is missing or invalid.',
            contacts: [],
        };
    }

    const collected = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    while (hasMore) {
        const response = await brevoRequest(`/contacts/lists/${finalListId}/contacts?limit=${limit}&offset=${offset}`, {
            method: 'GET',
        });

        const payload = response.data || {};
        const pageContacts = Array.isArray(payload.contacts)
            ? payload.contacts
            : Array.isArray(payload.data)
                ? payload.data
                : Array.isArray(payload.items)
                    ? payload.items
                    : [];

        collected.push(...pageContacts);

        const count = Number(payload.count ?? payload.total ?? pageContacts.length);
        const pageSize = pageContacts.length;
        offset += pageSize;
        hasMore = pageSize > 0 && offset < count;

        if (!pageSize) {
            hasMore = false;
        }
    }

    const emails = Array.from(new Set(
        collected
            .filter(contactAllowed)
            .map((contact) => String(contact?.email || '').trim().toLowerCase())
            .filter((email) => email && email.includes('@'))
    ));

    return {
        success: true,
        listId: finalListId,
        contacts: collected,
        emails,
    };
}

function contactAllowed(contact) {
    if (!contact || typeof contact !== 'object') return false;
    if (contact.emailBlacklisted === true) return false;
    return Boolean(contact.email);
}
