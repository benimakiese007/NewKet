import { supabaseAdmin, supabase } from '../config/supabase.js';

const client = supabaseAdmin || supabase;
const NK_TOKEN_USD_VALUE = 0.5;

function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function normalizeReferralCode(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '');
}

function slugReferralBase(value) {
    const base = String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '');

    return (base || 'newket').slice(0, 10).toUpperCase();
}

function generateReferralCode(userRow = {}, user = null) {
    const baseSource = userRow.name || userRow.company_name || user?.user_metadata?.full_name || user?.email || 'newket';
    const suffixSource = String(userRow.id || user?.id || '').replace(/-/g, '').toUpperCase();
    const suffix = (suffixSource.slice(0, 6) || Math.random().toString(36).slice(2, 8)).toUpperCase();
    return `${slugReferralBase(baseSource)}-${suffix}`;
}

async function fetchUserRow(userId) {
    if (!userId) return null;

    const { data, error } = await client
        .from('users')
        .select('id, name, email, role, status, referral_code, referred_by_user_id, referred_by_code, referral_claimed_at, referral_updated_at, nk_token_balance, nk_token_total_earned')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

async function ensureReferralCode(userRow, user) {
    const existingCode = normalizeReferralCode(userRow?.referral_code);
    if (existingCode) return existingCode;

    const referralCode = generateReferralCode(userRow, user);
    const { data, error } = await client
        .from('users')
        .update({
            referral_code: referralCode,
            referral_updated_at: new Date().toISOString()
        })
        .eq('id', userRow.id)
        .select('referral_code')
        .single();

    if (error) throw error;
    return normalizeReferralCode(data?.referral_code || referralCode);
}

async function loadInvitees(inviterId) {
    if (!inviterId) return [];

    const { data, error } = await client
        .from('referral_events')
        .select('id, inviter_id, invitee_id, referral_code, status, source, reward_amount, invited_at, qualified_at, rewarded_at')
        .eq('inviter_id', inviterId)
        .order('invited_at', { ascending: false })
        .limit(20);

    if (error) throw error;

    const events = Array.isArray(data) ? data : [];
    const inviteeIds = [...new Set(events.map((event) => event.invitee_id).filter(Boolean))];

    let inviteesById = new Map();
    if (inviteeIds.length) {
        const { data: inviteeRows, error: inviteeError } = await client
            .from('users')
            .select('id, name, email, avatar, role, status, date_joined')
            .in('id', inviteeIds);

        if (inviteeError) throw inviteeError;
        inviteesById = new Map((inviteeRows || []).map((row) => [row.id, row]));
    }

    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    const rows = events.map((event) => {
        const invitee = inviteesById.get(event.invitee_id) || null;
        
        let status = event.status;
        if (status === 'pending' && event.invited_at) {
            const invitedDate = new Date(event.invited_at).getTime();
            if ((now - invitedDate) > THIRTY_DAYS_MS) {
                status = 'invalid';
                event.notes = 'Expired (30 days limit)';
            }
        }

        return {
            ...event,
            status,
            invitee: invitee
                ? {
                    id: invitee.id,
                    name: invitee.name,
                    email: invitee.email,
                    avatar: invitee.avatar,
                    role: invitee.role,
                    status: invitee.status,
                    created_at: invitee.date_joined || null,
                    date_joined: invitee.date_joined || null
                }
                : null
        };
    });

    return rows;
}

async function loadReferralAdminDataset(limit = 250) {
    const normalizedLimit = Math.max(1, Math.min(1000, Number(limit) || 250));

    const [eventsResult, usersResult] = await Promise.all([
        client
            .from('referral_events')
            .select('id, inviter_id, invitee_id, referral_code, status, source, reward_amount, invited_at, qualified_at, rewarded_at, notes')
            .order('invited_at', { ascending: false })
            .limit(normalizedLimit),
        client
            .from('users')
            .select('id, name, email, role, status, referral_code, referred_by_user_id, referred_by_code, referral_claimed_at, referral_updated_at, nk_token_balance, nk_token_total_earned, date_joined')
    ]);

    if (eventsResult.error) throw eventsResult.error;
    if (usersResult.error) throw usersResult.error;

    const users = Array.isArray(usersResult.data) ? usersResult.data : [];
    const usersById = new Map(users.map((row) => [row.id, row]));
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    const events = (Array.isArray(eventsResult.data) ? eventsResult.data : []).map((event) => {
        const inviter = usersById.get(event.inviter_id) || null;
        const invitee = usersById.get(event.invitee_id) || null;

        let status = event.status;
        if (status === 'pending' && event.invited_at) {
            const invitedDate = new Date(event.invited_at).getTime();
            if ((now - invitedDate) > THIRTY_DAYS_MS) {
                status = 'invalid';
                event.notes = 'Expired (30 days limit)';
            }
        }

        return {
            ...event,
            status,
            inviter,
            invitee
        };
    });

    const statusCounts = events.reduce((acc, event) => {
        const key = String(event.status || 'pending').toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, { pending: 0, qualified: 0, rewarded: 0, invalid: 0 });

    const totals = events.reduce((acc, event) => {
        const rewardAmount = safeNumber(event.reward_amount);
        acc.referral_events += 1;
        acc.reward_total += rewardAmount;
        if (event.inviter_id) acc.active_referrers.add(event.inviter_id);
        if (event.status === 'rewarded') acc.rewarded_events += 1;
        if (event.status === 'qualified') acc.qualified_events += 1;
        if (event.status === 'pending') acc.pending_events += 1;
        if (event.status === 'invalid') acc.invalid_events += 1;
        return acc;
    }, {
        referral_events: 0,
        reward_total: 0,
        rewarded_events: 0,
        qualified_events: 0,
        pending_events: 0,
        invalid_events: 0,
        active_referrers: new Set()
    });

    const allReferralUsers = users.filter((user) => String(user.referral_code || '').trim());
    const usersWithReferralBalance = users.reduce((acc, user) => acc + safeNumber(user.nk_token_balance), 0);
    const usersWithTotalEarned = users.reduce((acc, user) => acc + safeNumber(user.nk_token_total_earned), 0);

    const topReferrersMap = new Map();
    events.forEach((event) => {
        if (!event.inviter_id) return;
        const inviter = usersById.get(event.inviter_id) || null;
        const current = topReferrersMap.get(event.inviter_id) || {
            inviter_id: event.inviter_id,
            referral_code: inviter?.referral_code || null,
            name: inviter?.name || 'Utilisateur supprime',
            email: inviter?.email || null,
            total_events: 0,
            pending: 0,
            qualified: 0,
            rewarded: 0,
            invalid: 0,
            reward_total: 0,
            nk_token_balance: safeNumber(inviter?.nk_token_balance),
            nk_token_total_earned: safeNumber(inviter?.nk_token_total_earned)
        };

        current.total_events += 1;
        current.reward_total += safeNumber(event.reward_amount);
        const status = String(event.status || 'pending').toLowerCase();
        if (status in current) {
            current[status] += 1;
        } else {
            current.invalid += 1;
        }
        topReferrersMap.set(event.inviter_id, current);
    });

    const topReferrers = [...topReferrersMap.values()]
        .sort((a, b) => {
            if (b.rewarded !== a.rewarded) return b.rewarded - a.rewarded;
            if (b.total_events !== a.total_events) return b.total_events - a.total_events;
            return (b.reward_total || 0) - (a.reward_total || 0);
        })
        .slice(0, 10);

    const recentEvents = events.slice(0, normalizedLimit).map((event) => ({
        id: event.id,
        inviter_id: event.inviter_id,
        invitee_id: event.invitee_id,
        referral_code: event.referral_code,
        status: event.status,
        source: event.source,
        reward_amount: safeNumber(event.reward_amount),
        invited_at: event.invited_at || null,
        qualified_at: event.qualified_at || null,
        rewarded_at: event.rewarded_at || null,
        notes: event.notes || null,
        inviter: event.inviter
            ? {
                id: event.inviter.id,
                name: event.inviter.name,
                email: event.inviter.email,
                role: event.inviter.role,
                status: event.inviter.status,
                referral_code: event.inviter.referral_code
            }
            : null,
        invitee: event.invitee
            ? {
                id: event.invitee.id,
                name: event.invitee.name,
                email: event.invitee.email,
                role: event.invitee.role,
                status: event.invitee.status,
                referral_code: event.invitee.referral_code,
                referred_by_code: event.invitee.referred_by_code,
                referral_claimed_at: event.invitee.referral_claimed_at,
                referral_updated_at: event.invitee.referral_updated_at,
                date_joined: event.invitee.date_joined || null,
                created_at: event.invitee.date_joined || null
            }
            : null
    }));

    return {
        nk_token_usd_value: NK_TOKEN_USD_VALUE,
        generated_at: new Date().toISOString(),
        totals: {
            referral_codes: allReferralUsers.length,
            referral_events: totals.referral_events,
            active_referrers: totals.active_referrers.size,
            pending: statusCounts.pending,
            qualified: statusCounts.qualified,
            rewarded: statusCounts.rewarded,
            invalid: statusCounts.invalid,
            reward_total: totals.reward_total,
            reward_total_usd: totals.reward_total * NK_TOKEN_USD_VALUE,
            nk_token_balance_total: usersWithReferralBalance,
            nk_token_balance_total_usd: usersWithReferralBalance * NK_TOKEN_USD_VALUE,
            nk_token_total_earned: usersWithTotalEarned,
            nk_token_total_earned_usd: usersWithTotalEarned * NK_TOKEN_USD_VALUE
        },
        status_breakdown: statusCounts,
        top_referrers: topReferrers,
        recent_events: recentEvents
    };
}

function summarizeInvitees(invitees = []) {
    return invitees.reduce((acc, invitee) => {
        acc.total += 1;
        if (invitee.status === 'rewarded') acc.rewarded += 1;
        else if (invitee.status === 'qualified') acc.qualified += 1;
        else if (invitee.status === 'pending') acc.pending += 1;
        else acc.invalid += 1;
        acc.reward_total += Number(invitee.reward_amount || 0);
        return acc;
    }, { total: 0, pending: 0, qualified: 0, rewarded: 0, invalid: 0, reward_total: 0 });
}

export async function getReferralSummaryForUser(user) {
    const userRow = await fetchUserRow(user.id);
    if (!userRow) {
        const err = new Error('Profil introuvable pour ce compte.');
        err.status = 404;
        throw err;
    }

    const referralCode = await ensureReferralCode(userRow, user);
    const invitees = await loadInvitees(userRow.id);
    const stats = summarizeInvitees(invitees);
    const rewardedInvitees = invitees
        .filter((invitee) => invitee.status === 'rewarded')
        .map((invitee) => ({
            id: invitee.id,
            inviter_id: invitee.inviter_id,
            invitee_id: invitee.invitee_id,
            referral_code: invitee.referral_code,
            reward_amount: Number(invitee.reward_amount || 0),
            reward_amount_usd: Number(invitee.reward_amount || 0) * NK_TOKEN_USD_VALUE,
            invited_at: invitee.invited_at || null,
            qualified_at: invitee.qualified_at || null,
            rewarded_at: invitee.rewarded_at || null,
            source: invitee.source || null,
            invitee: invitee.invitee
        }));
    const nkTokenBalance = Number(userRow.nk_token_balance || 0);
    const nkTokenTotalEarned = Number(userRow.nk_token_total_earned || 0);

    return {
        referral_code: referralCode,
        referral_link: `/pages/login?signup=1&ref=${encodeURIComponent(referralCode)}`,
        referred_by_user_id: userRow.referred_by_user_id || null,
        referred_by_code: userRow.referred_by_code || null,
        referral_claimed_at: userRow.referral_claimed_at || null,
        nk_token_rate_usd: NK_TOKEN_USD_VALUE,
        nk_token_balance: nkTokenBalance,
        nk_token_balance_usd: nkTokenBalance * NK_TOKEN_USD_VALUE,
        nk_token_total_earned: nkTokenTotalEarned,
        nk_token_total_earned_usd: nkTokenTotalEarned * NK_TOKEN_USD_VALUE,
        stats,
        invitees,
        reward_history: rewardedInvitees,
        reward_history_count: rewardedInvitees.length
    };
}

export async function getAdminReferralOverview(req, res, next) {
    try {
        const limit = Number(req.query?.limit || 250);
        const overview = await loadReferralAdminDataset(limit);
        return res.status(200).json({
            success: true,
            ...overview
        });
    } catch (error) {
        console.error('Erreur getAdminReferralOverview:', error);
        return next(error);
    }
}

export const getMyReferralSummary = async (req, res, next) => {
    try {
        const summary = await getReferralSummaryForUser(req.user);
        return res.status(200).json({ success: true, ...summary });
    } catch (error) {
        console.error('Erreur getMyReferralSummary:', error);
        return next(error);
    }
};

export const claimReferral = async (req, res, next) => {
    try {
        const code = normalizeReferralCode(
            req.body?.code ||
            req.user?.user_metadata?.referral_code_from ||
            req.user?.user_metadata?.referralCode ||
            ''
        );

        const userRow = await fetchUserRow(req.user.id);
        if (!userRow) {
            return res.status(404).json({ error: 'Profil introuvable pour ce compte.' });
        }

        if (String(userRow.role || '').toLowerCase() !== 'customer') {
            return res.status(403).json({
                error: 'Seuls les clients peuvent être parrainés.'
            });
        }

        const referralCode = await ensureReferralCode(userRow, req.user);

        if (!code) {
            return res.status(200).json({
                success: true,
                applied: false,
                referral_code: referralCode,
                referral_link: `/pages/login?signup=1&ref=${encodeURIComponent(referralCode)}`
            });
        }

        const existingCode = normalizeReferralCode(userRow.referred_by_code);
        if (userRow.referred_by_user_id) {
            if (existingCode === code) {
                const summary = await getReferralSummaryForUser(req.user);
                return res.status(200).json({ success: true, applied: true, already_claimed: true, ...summary });
            }

            return res.status(409).json({
                error: 'Ce compte a déjà un parrain.'
            });
        }

        const { data: inviter, error: inviterError } = await client
            .from('users')
            .select('id, name, email, referral_code')
            .eq('referral_code', code)
            .maybeSingle();

        if (inviterError) throw inviterError;

        if (!inviter) {
            return res.status(400).json({ error: 'Code de parrainage invalide.' });
        }

        if (String(inviter.id) === String(req.user.id)) {
            return res.status(400).json({ error: 'Vous ne pouvez pas utiliser votre propre code.' });
        }

        const timestamp = new Date().toISOString();
        const updatePayload = {
            referred_by_user_id: inviter.id,
            referred_by_code: code,
            referral_claimed_at: timestamp,
            referral_updated_at: timestamp
        };

        const { error: updateError } = await client
            .from('users')
            .update(updatePayload)
            .eq('id', req.user.id);

        if (updateError) throw updateError;

        const { error: eventError } = await client
            .from('referral_events')
            .upsert({
                inviter_id: inviter.id,
                invitee_id: req.user.id,
                referral_code: code,
                status: 'pending',
                source: 'signup',
                reward_amount: 0,
                invited_at: timestamp
            }, {
                onConflict: 'invitee_id'
            });

        if (eventError) throw eventError;

        const summary = await getReferralSummaryForUser(req.user);
        return res.status(200).json({
            success: true,
            applied: true,
            inviter: {
                id: inviter.id,
                name: inviter.name,
                email: inviter.email,
                referral_code: inviter.referral_code
            },
            ...summary
        });
    } catch (error) {
        console.error('Erreur claimReferral:', error);
        return next(error);
    }
};
