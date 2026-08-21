import { supabaseAdmin, supabase } from '../config/supabase.js';
import { getReferralSummaryForUser } from './referral.controller.js';

export const getPublicUserStats = async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        const { count, error } = await client
            .from('users')
            .select('id', { count: 'exact', head: true });

        if (error) throw error;

        const { data: recentUsers } = await client
            .from('users')
            .select('avatar')
            .not('avatar', 'is', null)
            .order('date_joined', { ascending: false })
            .limit(3);

        const recentAvatars = recentUsers?.map(u => u.avatar) || [];

        return res.status(200).json({
            totalUsers: Number(count) || 0,
            recentAvatars
        });
    } catch (err) {
        console.error('Error getPublicUserStats:', err.message);
        return res.status(500).json({ error: 'Failed to fetch public user stats' });
    }
};

export const getUsers = async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        // Return the fields the admin screens actually use.
        const { data, error } = await client
            .from('users')
            .select(`
                id,
                email,
                name,
                role,
                status,
                seller_type,
                avatar,
                cover_image,
                company_name,
                store_description,
                store_address,
                store_phone,

                preferred_payout_method,
                documents_url,
                rccm_document_url,
                physical_shop_url,
                shop_slug,
                date_joined,
                referral_code,
                referred_by_user_id,
                referred_by_code,
                referral_claimed_at,
                referral_updated_at,
                nk_token_balance,
                nk_token_total_earned
            `)
            .order('date_joined', { ascending: false });

        if (error) throw error;

        // Best-effort enrichment: if `users.avatar` is missing, try reading Supabase Auth metadata.
        // Never fail the endpoint if this lookup fails; it is only for UI convenience.
        let users = Array.isArray(data) ? data : [];
        const canReadAuthUsers = Boolean(supabaseAdmin?.auth?.admin?.getUserById);

        if (canReadAuthUsers) {
            const missingAvatarIds = [
                ...new Set(
                    users
                        .filter(u => u?.id && !u?.avatar)
                        .map(u => u.id)
                )
            ];

            if (missingAvatarIds.length) {
                const authResults = await Promise.allSettled(
                    missingAvatarIds.slice(0, 100).map((id) => supabaseAdmin.auth.admin.getUserById(id))
                );

                const avatarById = new Map();
                for (const result of authResults) {
                    if (result.status !== 'fulfilled') continue;
                    const user = result.value?.data?.user;
                    const id = user?.id;
                    if (!id) continue;
                    const meta = user.user_metadata || {};
                    const identityAvatar = user.identities?.[0]?.identity_data?.avatar_url || null;
                    const url = meta.avatar_url || meta.photo_url || meta.picture || meta.picture_url || identityAvatar || null;
                    if (url) avatarById.set(id, url);
                }

                if (avatarById.size) {
                    users = users.map(u => ({
                        ...u,
                        avatar: u.avatar || avatarById.get(u.id) || null
                    }));
                }
            }
        }

        return res.status(200).json(users);
    } catch (err) {
        console.error('Error getUsers:', err);

        const status = Number(err?.status || err?.statusCode || 500);
        const response = {
            error: err?.message || 'Failed to fetch users'
        };

        if (process.env.NODE_ENV === 'development') {
            if (err?.details) response.details = err.details;
            if (err?.hint) response.hint = err.hint;
            if (err?.code) response.code = err.code;
        }

        return res.status(status >= 400 ? status : 500).json(response);
    }
};

export const getUserReferralSummary = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'User id is required' });
        }

        const summary = await getReferralSummaryForUser({ id });
        return res.status(200).json({ success: true, ...summary });
    } catch (err) {
        console.error('Error getUserReferralSummary:', err.message);
        return res.status(err.status || 500).json({
            error: err.message || 'Failed to fetch user referral summary'
        });
    }
};

export const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const client = supabaseAdmin || supabase;

        const { data, error } = await client
            .from('users')
            .update({ status })
            .eq('id', id)
            .select();

        if (error) throw error;

        return res.status(200).json({ success: true, user: data[0] });
    } catch (err) {
        console.error('Error updateStatus:', err.message);
        return res.status(500).json({ error: 'Failed to update user status' });
    }
};

export const updateSellerType = async (req, res) => {
    try {
        const { id } = req.params;
        const { seller_type } = req.body;
        const normalizedType = String(seller_type || '').trim().toLowerCase();

        if (normalizedType !== 'certified') {
            return res.status(400).json({ error: 'Seller type invalid. Only certified is allowed for now.' });
        }

        const client = supabaseAdmin || supabase;

        const { data, error } = await client
            .from('users')
            .update({ seller_type: normalizedType })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({ success: true, user: data });
    } catch (err) {
        console.error('Error updateSellerType:', err.message);
        return res.status(500).json({ error: 'Failed to update user seller type' });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const client = supabaseAdmin || supabase;

        const { error } = await client
            .from('users')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Error deleteUser:', err.message);
        return res.status(500).json({ error: 'Failed to delete user' });
    }
};
