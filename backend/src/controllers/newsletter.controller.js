import { supabaseAdmin, supabase } from '../config/supabase.js';
import EmailService from '../services/emailService.js';
import {
    blacklistNewsletterContact,
    deleteNewsletterContact,
    getBrevoContactsInList,
    syncNewsletterSubscribersToBrevo,
    unblacklistNewsletterContact,
    upsertNewsletterContact
} from '../services/brevo.service.js';

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

async function saveNewsletterSubscriber({ email, source = 'footer' }) {
    const client = supabaseAdmin || supabase;
    const normalizedEmail = normalizeEmail(email);

    const { data: existing, error: lookupError } = await client
        .from('newsletter_subscribers')
        .select('id, status, source')
        .eq('email', normalizedEmail)
        .maybeSingle();

    if (lookupError) {
        throw lookupError;
    }

    if (existing) {
        const nextStatus = existing.status === 'unsubscribed' ? 'active' : existing.status || 'active';
        const { error: updateError } = await client
            .from('newsletter_subscribers')
            .update({
                status: nextStatus,
                source
            })
            .eq('id', existing.id);

        if (updateError) {
            throw updateError;
        }

        return {
            created: false,
            reactivated: existing.status === 'unsubscribed',
            alreadyActive: existing.status !== 'unsubscribed',
            status: nextStatus,
            id: existing.id
        };
    }

    const { data: inserted, error: insertError } = await client
        .from('newsletter_subscribers')
        .insert({
            email: normalizedEmail,
            source,
            status: 'active',
            created_at: new Date().toISOString()
        })
        .select('id, status')
        .single();

    if (insertError) {
        throw insertError;
    }

    return { created: true, reactivated: false, alreadyActive: false, status: inserted?.status || 'active', id: inserted?.id };
}

async function getNewsletterSubscriberById(id) {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
        .from('newsletter_subscribers')
        .select('id, email, status, source, created_at')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}

async function updateNewsletterSubscriberStatus(id, status, source = 'admin') {
    const client = supabaseAdmin || supabase;
    const { error } = await client
        .from('newsletter_subscribers')
        .update({ status, source })
        .eq('id', id);

    if (error) {
        throw error;
    }
}

async function removeNewsletterSubscriber(id) {
    const client = supabaseAdmin || supabase;
    const { error } = await client
        .from('newsletter_subscribers')
        .delete()
        .eq('id', id);

    if (error) {
        throw error;
    }
}

export const subscribeNewsletter = async (req, res) => {
    try {
        const { email, source = 'footer' } = req.body || {};
        const normalizedEmail = normalizeEmail(email);

        if (!normalizedEmail || !normalizedEmail.includes('@')) {
            return res.status(400).json({ error: 'Valid email is required.' });
        }

        const subscriber = await saveNewsletterSubscriber({ email: normalizedEmail, source });

        let brevoResult = null;
        try {
            brevoResult = await upsertNewsletterContact(normalizedEmail, { source });
        } catch (brevoError) {
            console.warn('[Newsletter] Brevo sync failed:', brevoError.message);
        }

        let welcomeResult = null;
        if (subscriber.created || subscriber.reactivated) {
            try {
                welcomeResult = await EmailService.sendNewsletterWelcome(normalizedEmail, { source });
            } catch (welcomeError) {
                console.warn('[Newsletter] Welcome email failed:', welcomeError.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: subscriber.created
                ? 'Subscription saved. Welcome email sent if delivery succeeded.'
                : subscriber.reactivated
                    ? 'Subscription restored. Welcome email sent if delivery succeeded.'
                    : 'Subscription already active.',
            subscriber,
            brevoSynced: Boolean(brevoResult?.success),
            brevoSkipped: Boolean(brevoResult?.skipped),
            brevoWarning: brevoResult?.skipped ? brevoResult?.reason : null,
            welcomeSent: Boolean(welcomeResult?.success)
        });
    } catch (err) {
        console.error('Error subscribeNewsletter:', err.message);
        return res.status(500).json({ error: 'Internal server error while subscribing.' });
    }
};

export const unsubscribeNewsletterSubscriber = async (req, res) => {
    try {
        const { id } = req.params;
        const subscriber = await getNewsletterSubscriberById(id);

        if (!subscriber) {
            return res.status(404).json({ error: 'Subscriber not found.' });
        }

        await updateNewsletterSubscriberStatus(id, 'unsubscribed', 'admin');

        let brevoResult = null;
        try {
            brevoResult = await blacklistNewsletterContact(subscriber.email);
        } catch (brevoError) {
            console.warn('[Newsletter] Brevo unsubscribe sync failed:', brevoError.message);
        }

        return res.status(200).json({
            success: true,
            message: 'Subscriber unsubscribed.',
            brevoSynced: Boolean(brevoResult?.success),
            brevoSkipped: Boolean(brevoResult?.skipped)
        });
    } catch (err) {
        console.error('Error unsubscribeNewsletterSubscriber:', err.message);
        return res.status(500).json({ error: 'Internal server error while unsubscribing.' });
    }
};

export const resubscribeNewsletterSubscriber = async (req, res) => {
    try {
        const { id } = req.params;
        const subscriber = await getNewsletterSubscriberById(id);

        if (!subscriber) {
            return res.status(404).json({ error: 'Subscriber not found.' });
        }

        await updateNewsletterSubscriberStatus(id, 'active', 'admin');

        let brevoResult = null;
        try {
            brevoResult = await unblacklistNewsletterContact(subscriber.email);
        } catch (brevoError) {
            console.warn('[Newsletter] Brevo resubscribe sync failed:', brevoError.message);
        }

        return res.status(200).json({
            success: true,
            message: 'Subscriber reactivated.',
            brevoSynced: Boolean(brevoResult?.success),
            brevoSkipped: Boolean(brevoResult?.skipped)
        });
    } catch (err) {
        console.error('Error resubscribeNewsletterSubscriber:', err.message);
        return res.status(500).json({ error: 'Internal server error while reactivating.' });
    }
};

export const deleteNewsletterSubscriber = async (req, res) => {
    try {
        const { id } = req.params;
        const subscriber = await getNewsletterSubscriberById(id);

        if (!subscriber) {
            return res.status(404).json({ error: 'Subscriber not found.' });
        }

        let brevoResult = null;
        try {
            brevoResult = await deleteNewsletterContact(subscriber.email);
        } catch (brevoError) {
            console.warn('[Newsletter] Brevo delete sync failed:', brevoError.message);
        }

        await removeNewsletterSubscriber(id);

        return res.status(200).json({
            success: true,
            message: 'Subscriber deleted.',
            brevoSynced: Boolean(brevoResult?.success),
            brevoSkipped: Boolean(brevoResult?.skipped)
        });
    } catch (err) {
        console.error('Error deleteNewsletterSubscriber:', err.message);
        return res.status(500).json({ error: 'Internal server error while deleting subscriber.' });
    }
};

export const syncNewsletterBackfill = async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        const { data, error } = await client
            .from('newsletter_subscribers')
            .select('email, status')
            .neq('status', 'unsubscribed');

        if (error) {
            throw error;
        }

        const emails = (data || []).map((row) => row.email).filter(Boolean);
        const result = await syncNewsletterSubscribersToBrevo(emails);

        return res.status(200).json({
            success: true,
            message: 'Newsletter backfill synced.',
            ...result
        });
    } catch (err) {
        console.error('Error syncNewsletterBackfill:', err.message);
        return res.status(500).json({ error: 'Internal server error while syncing newsletter.' });
    }
};

export const sendNewsletter = async (req, res) => {
    try {
        const { subject, content } = req.body;

        if (!subject || !content) {
            return res.status(400).json({ error: 'Subject and Content are required.' });
        }

        const client = supabaseAdmin || supabase;
        let emails = [];
        let source = 'brevo';

        try {
            const brevoResult = await getBrevoContactsInList();
            emails = brevoResult.emails || [];
        } catch (brevoError) {
            console.warn('[Newsletter] Brevo list fetch failed, falling back to local subscribers:', brevoError.message);
        }

        if (!emails.length) {
            source = 'supabase';
            const { data: subscribers, error } = await client
                .from('newsletter_subscribers')
                .select('email')
                .neq('status', 'unsubscribed')
                .neq('email', null);

            if (error) {
                throw error;
            }

            emails = (subscribers || []).map((subscriber) => subscriber.email).filter(Boolean);
        }

        if (!emails.length) {
            return res.status(404).json({ error: 'No newsletter recipients found.' });
        }

        const result = await EmailService.sendNewsletter({
            emails,
            subject,
            content
        });

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Newsletter dispatched successfully.',
                totalSent: result.totalSent,
                source
            });
        }

        return res.status(500).json({ error: 'Failed to send newsletter.', details: result.error });
    } catch (err) {
        console.error('Error sendNewsletter:', err.message);
        return res.status(500).json({ error: 'Internal server error while sending newsletter.' });
    }
};
