import { supabaseAdmin, supabase } from '../config/supabase.js';

const client = supabaseAdmin || supabase;

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
        .select('id, name, email, role, status, referral_code, referred_by_user_id, referred_by_code, referral_claimed_at, referral_updated_at')
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
            .select('id, name, email, avatar, role, status, created_at')
            .in('id', inviteeIds);

        if (inviteeError) throw inviteeError;
        inviteesById = new Map((inviteeRows || []).map((row) => [row.id, row]));
    }

    const rows = events.map((event) => {
        const invitee = inviteesById.get(event.invitee_id) || null;
        return {
            ...event,
            invitee: invitee
                ? {
                    id: invitee.id,
                    name: invitee.name,
                    email: invitee.email,
                    avatar: invitee.avatar,
                    role: invitee.role,
                    status: invitee.status,
                    created_at: invitee.created_at
                }
                : null
        };
    });

    return rows;
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

async function getReferralSummaryForUser(user) {
    const userRow = await fetchUserRow(user.id);
    if (!userRow) {
        const err = new Error('Profil introuvable pour ce compte.');
        err.status = 404;
        throw err;
    }

    const referralCode = await ensureReferralCode(userRow, user);
    const invitees = await loadInvitees(userRow.id);
    const stats = summarizeInvitees(invitees);

    return {
        referral_code: referralCode,
        referral_link: `/pages/login?signup=1&ref=${encodeURIComponent(referralCode)}`,
        referred_by_user_id: userRow.referred_by_user_id || null,
        referred_by_code: userRow.referred_by_code || null,
        referral_claimed_at: userRow.referral_claimed_at || null,
        stats,
        invitees
    };
}

export const getMyReferralSummary = async (req, res) => {
    try {
        const summary = await getReferralSummaryForUser(req.user);
        return res.status(200).json({ success: true, ...summary });
    } catch (error) {
        console.error('Erreur getMyReferralSummary:', error);
        return res.status(error.status || 500).json({
            error: error.message || 'Impossible de charger votre parrainage.'
        });
    }
};

export const claimReferral = async (req, res) => {
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
        return res.status(error.status || 500).json({
            error: error.message || 'Impossible de valider ce code de parrainage.'
        });
    }
};
