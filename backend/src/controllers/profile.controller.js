import { createUserSupabaseClient, hasServiceRoleKey, supabaseAdmin } from '../config/supabase.js';
import sharp from 'sharp';

function getProfileClient(req) {
    return hasServiceRoleKey ? supabaseAdmin : createUserSupabaseClient(req.token);
}

function normalizeLoginUsername(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');
}

function isValidLoginUsername(value) {
    const normalized = normalizeLoginUsername(value);
    return (
        normalized.length >= 8 &&
        /^[a-z0-9_-]+$/.test(normalized) &&
        /[a-z]/.test(normalized)
    );
}

async function findUsernameConflict(sb, username, userId = null) {
    const normalized = normalizeLoginUsername(username);
    if (!normalized) return null;

    const { data, error } = await sb
        .from('users')
        .select('id, email, username, company_name, name, shop_slug, username_reserved_value, username_reserved_until')
        .or([
            `username.ilike.${normalized}`,
            `company_name.ilike.${normalized}`,
            `name.ilike.${normalized}`,
            `shop_slug.ilike.${normalized}`,
            `username_reserved_value.ilike.${normalized}`
        ].join(','))
        .limit(20);

    if (error) throw error;

    const now = Date.now();
    return (Array.isArray(data) ? data : []).find((row) => {
        if (userId && String(row.id) === String(userId)) return false;
        const active = normalizeLoginUsername(row.username);
        const store = normalizeLoginUsername(row.company_name);
        const display = normalizeLoginUsername(row.name);
        const slug = normalizeLoginUsername(row.shop_slug);
        const reserved = normalizeLoginUsername(row.username_reserved_value);
        const reservedUntil = row.username_reserved_until ? new Date(row.username_reserved_until).getTime() : 0;
        return active === normalized || store === normalized || display === normalized || slug === normalized || (reserved === normalized && reservedUntil > now);
    }) || null;
}

export const getMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifie' });

        const sb = getProfileClient(req);
        const { data, error } = await sb
            .from('users')
            .select('id, email, name, username, first_name, last_name, role, status, avatar, company_name, store_phone, cover_image, shipping_time, date_joined, shop_slug, username_changed_at, username_reserved_value, username_reserved_until')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (!data) return res.json(null);
        res.json({
            ...data,
            phone: data.store_phone || null
        });
    } catch (err) {
        console.error('Erreur getMyProfile:', err);
        res.status(500).json({ error: 'Erreur lors de la recuperation du profil.' });
    }
};

export const updateMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifie' });

        const sb = getProfileClient(req);
        const updates = req.body || {};
        const current = await sb
            .from('users')
            .select('id, role, username, company_name, name, username_reserved_value, username_reserved_until, username_changed_at')
            .eq('id', userId)
            .single();

        if (current.error) throw current.error;

        const incomingUsername = typeof updates.username === 'string'
            ? normalizeLoginUsername(updates.username)
            : '';
        const incomingFirstName = typeof updates.first_name === 'string'
            ? updates.first_name.trim()
            : undefined;
        const incomingLastName = typeof updates.last_name === 'string'
            ? updates.last_name.trim()
            : undefined;

        const allowed = {
            store_phone: typeof updates.phone === 'string' ? updates.phone.trim() : undefined,
            shipping_time: typeof updates.shipping_time === 'string' ? updates.shipping_time.trim() : undefined,
            store_description: typeof updates.store_description === 'string' ? updates.store_description.trim() : undefined
        };
        if (typeof updates.email === 'string') allowed.email = updates.email.trim().toLowerCase();
        if (incomingFirstName !== undefined) allowed.first_name = incomingFirstName;
        if (incomingLastName !== undefined) allowed.last_name = incomingLastName;
        if (incomingUsername) {
            if (!isValidLoginUsername(incomingUsername)) {
                return res.status(422).json({ error: 'Le nom d\'utilisateur doit contenir au moins 8 caracteres, en minuscules, avec des lettres obligatoires.' });
            }

            const conflict = await findUsernameConflict(sb, incomingUsername, userId);
            if (conflict) {
                return res.status(409).json({ error: 'Ce nom d\'utilisateur est deja pris.' });
            }

            allowed.username = incomingUsername;
            allowed.name = incomingUsername;

            if (current.data?.role === 'supplier') {
                allowed.company_name = incomingUsername;
                allowed.shop_slug = incomingUsername;
            }
        } else if (current.data?.role === 'supplier') {
            const fallbackStore = typeof updates.company_name === 'string' ? normalizeLoginUsername(updates.company_name) : normalizeLoginUsername(current.data?.company_name || current.data?.name);
            if (fallbackStore && isValidLoginUsername(fallbackStore)) {
                allowed.company_name = fallbackStore;
                allowed.username = fallbackStore;
                allowed.name = fallbackStore;
                allowed.shop_slug = fallbackStore;
            }
        }

        Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);

        const { data, error } = await sb
            .from('users')
            .update({ ...allowed })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        if (hasServiceRoleKey) {
            try {
                await supabaseAdmin.auth.admin.updateUserById(userId, {
                    user_metadata: {
                        ...req.user?.user_metadata,
                        username: data.username || data.name || null,
                        first_name: data.first_name || null,
                        last_name: data.last_name || null,
                        company_name: data.company_name || null,
                        role: data.role || req.user?.app_metadata?.role || null
                    }
                });
            } catch (authError) {
                console.warn('Avertissement updateUserById profile:', authError);
            }
        }

        res.json({ success: true, data: { ...data, phone: data?.store_phone || null } });
    } catch (err) {
        console.error('Erreur updateMyProfile:', err);
        const code = String(err?.code || '');
        if (code === '23505') {
            return res.status(409).json({ error: 'Ce nom d\'utilisateur est deja pris.' });
        }
        if (code === '23514') {
            return res.status(422).json({ error: err.message || 'Données invalides.' });
        }
        res.status(500).json({ error: 'Erreur lors de la mise a jour du profil.' });
    }
};

export const checkUsernameAvailability = async (req, res) => {
    try {
        const raw = req.query?.username || req.query?.name || '';
        const username = normalizeLoginUsername(raw);
        if (!username) {
            return res.status(400).json({ error: 'Nom d\'utilisateur manquant.' });
        }

        if (!isValidLoginUsername(username)) {
            return res.status(422).json({
                available: false,
                error: 'Le nom d\'utilisateur doit contenir au moins 8 caracteres, en minuscules, avec des lettres obligatoires.'
            });
        }

        const sb = getProfileClient(req);
        const conflict = await findUsernameConflict(sb, username, req.user?.id || null);
        return res.json({
            available: !conflict,
            username
        });
    } catch (err) {
        console.error('Erreur checkUsernameAvailability:', err);
        res.status(500).json({ error: 'Erreur lors de la verification du nom d\'utilisateur.' });
    }
};

export const resolveUsernameToEmail = async (req, res) => {
    try {
        const raw = req.query?.username || req.query?.name || '';
        const username = normalizeLoginUsername(raw);
        if (!username) {
            return res.status(400).json({ error: 'Nom d\'utilisateur manquant.' });
        }

        const sb = getProfileClient(req);
        const { data, error } = await sb
            .from('users')
            .select('id, email, username, company_name, name, shop_slug, role, status')
            .or([
                `username.ilike.${username}`,
                `company_name.ilike.${username}`,
                `name.ilike.${username}`,
                `shop_slug.ilike.${username}`
            ].join(','))
            .limit(5);

        if (error) throw error;

        const match = (Array.isArray(data) ? data : []).find((row) => {
            const candidates = [
                row.username,
                row.company_name,
                row.name,
                row.shop_slug
            ].map(normalizeLoginUsername);
            return candidates.includes(username);
        });

        if (!match?.email) {
            return res.status(404).json({ error: 'Utilisateur introuvable.' });
        }

        res.json({
            email: match.email,
            username: match.username || match.company_name || match.name || username,
            role: match.role || null,
            status: match.status || null
        });
    } catch (err) {
        console.error('Erreur resolveUsernameToEmail:', err);
        res.status(500).json({ error: 'Erreur lors de la resolution du nom d\'utilisateur.' });
    }
};

export const uploadMyAvatar = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifie' });

        const sb = getProfileClient(req);

        const imageData = req.body?.imageData;
        if (!imageData || typeof imageData !== 'string') {
            return res.status(400).json({ error: 'Image manquante.' });
        }

        const dataUrlMatch = imageData.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
        if (!dataUrlMatch) {
            return res.status(400).json({ error: 'Format image non supporte.' });
        }

        let fileBuffer = Buffer.from(dataUrlMatch[2], 'base64');

        if (!fileBuffer.length) {
            return res.status(400).json({ error: 'Image vide.' });
        }

        if (fileBuffer.length > 2 * 1024 * 1024) {
            return res.status(400).json({ error: 'Image trop lourde. Maximum 2 Mo.' });
        }

        // Conversion et compression systématique en WebP
        try {
            fileBuffer = await sharp(fileBuffer)
                .webp({ quality: 80 })
                .toBuffer();
        } catch (sharpError) {
            console.error('Erreur lors de la conversion WebP:', sharpError);
            return res.status(500).json({ error: "Erreur de traitement de l'image." });
        }

        const mimeType = 'image/webp';
        const extension = 'webp';
        const filePath = `avatars/${userId}_${Date.now()}.${extension}`;

        const { error: uploadError } = await sb
            .storage
            .from('user-assets')
            .upload(filePath, fileBuffer, {
                contentType: mimeType,
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = sb
            .storage
            .from('user-assets')
            .getPublicUrl(filePath);

        const publicUrl = publicUrlData?.publicUrl;
        if (!publicUrl) {
            return res.status(500).json({ error: 'URL publique introuvable.' });
        }

        const { error: profileError } = await sb
            .from('users')
            .update({ avatar: publicUrl })
            .eq('id', userId);

        if (profileError) throw profileError;

        if (hasServiceRoleKey) {
            try {
                await supabaseAdmin.auth.admin.updateUserById(userId, {
                    user_metadata: { avatar_url: publicUrl }
                });
            } catch (authError) {
                console.warn('Avertissement updateUserById avatar:', authError);
            }
        }

        res.json({ success: true, avatar: publicUrl });
    } catch (err) {
        console.error('Erreur uploadMyAvatar:', err);
        const debug = process.env.NODE_ENV !== 'production';
        res.status(500).json({
            error: 'Erreur lors de l\'upload de l\'avatar.',
            ...(debug ? { details: err?.message || String(err) } : {})
        });
    }
};
