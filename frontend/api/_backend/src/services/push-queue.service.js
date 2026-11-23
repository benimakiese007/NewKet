import { supabaseAdmin } from '../config/supabase.js';
import WebPushService from './webPushService.js';

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCHES_PER_RUN = 20;
const RETRY_DELAY_SECONDS = 300;

function nowIso() {
    return new Date().toISOString();
}

async function updateJob(jobId, patch) {
    const { error } = await supabaseAdmin
        .from('push_notification_jobs')
        .update({
            ...patch,
            updated_at: nowIso()
        })
        .eq('id', jobId);

    if (error) throw error;
}

async function claimDuePushJobs(batchSize = DEFAULT_BATCH_SIZE) {
    const { data, error } = await supabaseAdmin.rpc('claim_push_notification_jobs', {
        batch_size: batchSize
    });

    if (error) {
        // The Postgres function may not exist yet (schema not migrated).
        // In that case we return an empty array instead of crashing.
        if (
            error.message?.includes('Could not find the function') ||
            error.code === 'PGRST202'
        ) {
            return [];
        }
        throw error;
    }
    return Array.isArray(data) ? data : [];
}

async function processSingleJob(job) {
    const startedAt = nowIso();

    // Gestion des jobs typés (ex : rappel escrow T+12h)
    if (job.notification?._type === 'escrow_reminder') {
        try {
            const orderId = job.notification.order_id;
            if (orderId) {
                const { data: order } = await supabaseAdmin
                    .from('orders')
                    .select('*')
                    .eq('id', orderId)
                    .single();

                // N'envoyer que si la commande est encore en attente de validation
                if (order && order.status === 'DELIVERED') {
                    // Lazy import to avoid circular dependency
                    const { default: NotificationSvc } = await import('./notificationService.js');
                    await NotificationSvc.notifyEscrowReminder(order);
                }
            }
            await updateJob(job.id, {
                status: 'sent',
                finished_at: startedAt,
                last_error: null,
                sent_count: 1
            });
            return { status: 'sent', sent: 1 };
        } catch (err) {
            await updateJob(job.id, {
                status: 'failed',
                finished_at: startedAt,
                last_error: err?.message || String(err),
                sent_count: 0
            });
            return { status: 'failed', error: err?.message };
        }
    }

    if (!WebPushService.isConfigured()) {
        await updateJob(job.id, {
            status: 'failed',
            finished_at: startedAt,
            last_error: 'Web push disabled or missing VAPID keys',
            sent_count: 0
        });
        return { status: 'failed', sent: 0 };
    }

    try {
        const result = await WebPushService.sendForNotification(job.notification);
        const sent = Number(result?.sent || 0);

        await updateJob(job.id, {
            status: 'sent',
            finished_at: startedAt,
            last_error: null,
            sent_count: sent
        });

        return { status: 'sent', sent };
    } catch (error) {
        const retryable = (job.attempts || 0) < (job.max_attempts || 0);
        const nextAvailableAt = retryable
            ? new Date(Date.now() + RETRY_DELAY_SECONDS * 1000).toISOString()
            : startedAt;

        await updateJob(job.id, {
            status: retryable ? 'queued' : 'failed',
            available_at: nextAvailableAt,
            finished_at: startedAt,
            last_error: error?.message || String(error),
            sent_count: 0
        });

        return {
            status: retryable ? 'queued' : 'failed',
            error: error?.message || String(error)
        };
    }
}

export async function enqueuePushNotification(notification) {
    const { data, error } = await supabaseAdmin
        .from('push_notification_jobs')
        .insert({
            notification,
            status: 'queued',
            available_at: nowIso()
        })
        .select('id, status, attempts')
        .single();

    if (error) throw error;

    void processDuePushNotificationJobs({ batchSize: DEFAULT_BATCH_SIZE, maxBatches: 1 }).catch((err) => {
        console.error('[PushQueue] Background drain failed:', err);
    });

    return data;
}

export async function processDuePushNotificationJobs({ batchSize = DEFAULT_BATCH_SIZE, maxBatches = MAX_BATCHES_PER_RUN } = {}) {
    const summary = {
        claimed: 0,
        sent: 0,
        failed: 0,
        requeued: 0
    };

    for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
        const jobs = await claimDuePushJobs(batchSize);
        if (jobs.length === 0) break;

        summary.claimed += jobs.length;

        for (const job of jobs) {
            const result = await processSingleJob(job);
            if (result.status === 'sent') {
                summary.sent += 1;
            } else if (result.status === 'queued') {
                summary.requeued += 1;
            } else {
                summary.failed += 1;
            }
        }

        if (jobs.length < batchSize) break;
    }

    return summary;
}

export async function processDuePushNotificationJobsJob() {
    const summary = await processDuePushNotificationJobs();
    return {
        ...summary,
        ran_at: nowIso()
    };
}
