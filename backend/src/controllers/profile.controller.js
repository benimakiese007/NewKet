import { createUserSupabaseClient, hasServiceRoleKey, supabaseAdmin } from '../config/supabase.js';
import sharp from 'sharp';

function getProfileClient(req) {
    return hasServiceRoleKey ? supabaseAdmin : createUserSupabaseClient(req.token);
}

const USERNAME_LOCK_DAYS = 14;
const USERNAME_LOCK_MS = USERNAME_LOCK_DAYS * 24 * 60 * 60 * 1000;
const LEGACY_PROFILE_SELECT = 'id, email, name, role, status, avatar, company_name, store_phone, cover_image, shipping_time, date_joined, store_description';

function normalizeLoginUsername(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
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

function isMissingColumnError(err) {
    const code = String(err?.code || '');
    const message = String(err?.message || err?.details || '').toLowerCase();
    return code === '42703' || (message.includes('column') && message.includes('does not exist'));
}

function getUserMetadata(user) {
    return user?.user_metadata || {};
}

function getResolvedUsername(row = null, authUser = null) {
    const metadata = getUserMetadata(authUser);
    return normalizeLoginUsername(
        metadata.username ||
        metadata.company_name ||
        metadata.name ||
        row?.username ||
        row?.company_name ||
        row?.name ||
        ''
    );
}

function getResolvedFirstName(row = null, authUser = null) {
    const metadata = getUserMetadata(authUser);
    return String(metadata.first_name || row?.first_name || '').trim();
}

function getResolvedLastName(row = null, authUser = null) {
    const metadata = getUserMetadata(authUser);
    return String(metadata.last_name || row?.last_name || '').trim();
}

function getResolvedLockState(row = null, authUser = null) {
    const metadata = getUserMetadata(authUser);
    const usernameChangedAt = metadata.username_changed_at || row?.username_changed_at || null;
    const usernameReservedValue = metadata.username_reserved_value || row?.username_reserved_value || null;
    const usernameReservedUntil = metadata.username_reserved_until || row?.username_reserved_until || null;
    const changedAtMs = usernameChangedAt ? new Date(usernameChangedAt).getTime() : 0;
    const reservedUntilMs = usernameReservedUntil ? new Date(usernameReservedUntil).getTime() : 0;

    return {
        changedAtMs,
        reservedUntilMs,
        reservedValue: normalizeLoginUsername(usernameReservedValue),
        isLocked: Boolean(changedAtMs && (Date.now() - changedAtMs) < USERNAME_LOCK_MS)
    };
}

async function getAuthUserById(userId) {
    if (!hasServiceRoleKey || !supabaseAdmin?.auth?.admin?.getUserById) {
        return null;
    }

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) throw error;
    return data?.user || null;
}

async function listAllAuthUsers() {
    if (!hasServiceRoleKey || !supabaseAdmin?.auth?.admin?.listUsers) {
        return [];
    }

    const users = [];
    const perPage = 1000;

    for (let page = 1; page <= 10; page += 1) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;

        const batch = data?.users || data || [];
        if (Array.isArray(batch) && batch.length) {
            users.push(...batch);
        }

        if (!Array.isArray(batch) || batch.length < perPage) {
            break;
        }
    }

    return users;
}

async function findUsernameConflict(sb, username, userId = null) {
    const normalized = normalizeLoginUsername(username);
    if (!normalized) return null;

    const { data, error } = await sb
        .from('users')
        .select('id, email, name, company_name')
        .or([
            `name.ilike.${normalized}`,
            `company_name.ilike.${normalized}`
        ].join(','))
        .limit(100);

    if (error && !isMissingColumnError(error)) throw error;

    const now = Date.now();
    const publicConflict = (Array.isArray(data) ? data : []).find((row) => {
        if (userId && String(row.id) === String(userId)) return false;
        const display = normalizeLoginUsername(row.name);
        const store = normalizeLoginUsername(row.company_name);
        return display === normalized || store === normalized;
    }) || null;

    if (publicConflict) return publicConflict;

    const authUsers = await listAllAuthUsers();
    return authUsers.find((user) => {
        if (userId && String(user.id) === String(userId)) return false;

        const metadata = getUserMetadata(user);
        const active = [
            metadata.username,
            metadata.company_name,
            metadata.name
        ].map(normalizeLoginUsername);
        const reserved = normalizeLoginUsername(metadata.username_reserved_value);
        const reservedUntil = metadata.username_reserved_until ? new Date(metadata.username_reserved_until).getTime() : 0;

        return active.includes(normalized) || (reserved === normalized && reservedUntil > now);
    }) || null;
}

export const getMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifie' });

        const sb = getProfileClient(req);
        const { data, error } = await sb
            .from('users')
            .select(LEGACY_PROFILE_SELECT)
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (!data) return res.json(null);

        const authUser = await getAuthUserById(userId);
        const metadata = getUserMetadata(authUser);

        res.json({
            ...data,
            username: getResolvedUsername(data, authUser),
            first_name: getResolvedFirstName(data, authUser) || null,
            last_name: getResolvedLastName(data, authUser) || null,
            company_name: metadata.company_name || data.company_name || getResolvedUsername(data, authUser) || null,
            username_changed_at: metadata.username_changed_at || data.username_changed_at || null,
            username_reserved_value: metadata.username_reserved_value || data.username_reserved_value || null,
            username_reserved_until: metadata.username_reserved_until || data.username_reserved_until || null,
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
        const currentResult = await sb
            .from('users')
            .select('id, role, name, company_name, store_phone, shipping_time, store_description')
            .eq('id', userId)
            .single();

        if (currentResult.error) throw currentResult.error;
        const current = currentResult.data || null;
        const currentAuthUser = await getAuthUserById(userId);
        const currentUsername = getResolvedUsername(current, currentAuthUser);
        const currentLock = getResolvedLockState(current, currentAuthUser);

        const incomingUsername = typeof updates.username === 'string'
            ? normalizeLoginUsername(updates.username)
            : '';
        const incomingFirstName = typeof updates.first_name === 'string'
            ? updates.first_name.trim()
            : undefined;
        const incomingLastName = typeof updates.last_name === 'string'
            ? updates.last_name.trim()
            : undefined;

        if (incomingUsername && incomingUsername !== currentUsername) {
            if (!isValidLoginUsername(incomingUsername)) {
                return res.status(422).json({ error: 'Le nom d\'utilisateur doit contenir au moins 8 caracteres, en minuscules, avec des lettres obligatoires.' });
            }

            if (currentLock.isLocked && incomingUsername !== currentLock.reservedValue) {
                return res.status(422).json({ error: 'Vous ne pouvez modifier le nom d\'utilisateur qu\'une fois tous les 14 jours.' });
            }

            const conflict = await findUsernameConflict(sb, incomingUsername, userId);
            if (conflict) {
                return res.status(409).json({ error: 'Ce nom d\'utilisateur est deja pris.' });
            }
        }

        const nextUsername = incomingUsername || currentUsername;
        const changedUsername = Boolean(incomingUsername && incomingUsername !== currentUsername);
        const usernameChangedAt = changedUsername
            ? new Date().toISOString()
            : (currentAuthUser?.user_metadata?.username_changed_at || current?.username_changed_at || null);
        const usernameReservedValue = changedUsername
            ? currentUsername
            : (currentAuthUser?.user_metadata?.username_reserved_value || current?.username_reserved_value || null);
        const usernameReservedUntil = changedUsername
            ? new Date(Date.now() + USERNAME_LOCK_MS).toISOString()
            : (currentAuthUser?.user_metadata?.username_reserved_until || current?.username_reserved_until || null);

        const allowed = {
            store_phone: typeof updates.phone === 'string' ? updates.phone.trim() : undefined,
            shipping_time: typeof updates.shipping_time === 'string' ? updates.shipping_time.trim() : undefined,
            store_description: typeof updates.store_description === 'string' ? updates.store_description.trim() : undefined,
            name: nextUsername || current?.name || currentAuthUser?.user_metadata?.name || undefined,
            company_name: nextUsername || current?.company_name || currentAuthUser?.user_metadata?.company_name || undefined,
            username: nextUsername || undefined,
            first_name: incomingFirstName !== undefined ? incomingFirstName : undefined,
            last_name: incomingLastName !== undefined ? incomingLastName : undefined,
            shop_slug: nextUsername || undefined,
            username_changed_at: usernameChangedAt || undefined,
            username_reserved_value: usernameReservedValue || undefined,
            username_reserved_until: usernameReservedUntil || undefined
        };
        if (typeof updates.email === 'string') allowed.email = updates.email.trim().toLowerCase();

        Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);

        const legacyUpdates = {
            email: allowed.email,
            store_phone: allowed.store_phone,
            shipping_time: allowed.shipping_time,
            store_description: allowed.store_description,
            name: allowed.name,
            company_name: allowed.company_name
        };
        Object.keys(legacyUpdates).forEach((k) => legacyUpdates[k] === undefined && delete legacyUpdates[k]);

        const applyProfileUpdate = async (payload) => {
            const result = await sb
                .from('users')
                .update(payload)
                .eq('id', userId)
                .select(LEGACY_PROFILE_SELECT)
                .single();

            if (result.error) {
                throw result.error;
            }

            return result.data;
        };

        let data;
        try {
            data = await applyProfileUpdate(allowed);
        } catch (updateError) {
            if (!isMissingColumnError(updateError)) {
                throw updateError;
            }

            data = await applyProfileUpdate(legacyUpdates);
        }

        if (hasServiceRoleKey) {
            try {
                await supabaseAdmin.auth.admin.updateUserById(userId, {
                    user_metadata: {
                        ...getUserMetadata(currentAuthUser),
                        username: nextUsername || getResolvedUsername(data, currentAuthUser) || null,
                        first_name: incomingFirstName !== undefined ? incomingFirstName : getResolvedFirstName(data, currentAuthUser) || null,
                        last_name: incomingLastName !== undefined ? incomingLastName : getResolvedLastName(data, currentAuthUser) || null,
                        company_name: nextUsername || data.company_name || getResolvedUsername(data, currentAuthUser) || null,
                        username_changed_at: usernameChangedAt,
                        username_reserved_value: usernameReservedValue,
                        username_reserved_until: usernameReservedUntil,
                        role: data.role || currentAuthUser?.app_metadata?.role || getUserMetadata(currentAuthUser)?.role || null
                    }
                });
            } catch (authError) {
                console.warn('Avertissement updateUserById profile:', authError);
            }
        }

        res.json({
            success: true,
            data: {
                ...data,
                username: nextUsername || data.username || data.name || null,
                first_name: incomingFirstName !== undefined ? incomingFirstName : getResolvedFirstName(data, currentAuthUser) || null,
                last_name: incomingLastName !== undefined ? incomingLastName : getResolvedLastName(data, currentAuthUser) || null,
                company_name: nextUsername || data.company_name || getResolvedUsername(data, currentAuthUser) || null,
                username_changed_at: usernameChangedAt,
                username_reserved_value: usernameReservedValue,
                username_reserved_until: usernameReservedUntil,
                phone: data?.store_phone || null
            }
        });
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

        const authUsers = await listAllAuthUsers();
        const match = authUsers.find((user) => {
            const metadata = getUserMetadata(user);
            const candidates = [
                metadata.username,
                metadata.company_name,
                metadata.name
            ].map(normalizeLoginUsername);
            const reserved = normalizeLoginUsername(metadata.username_reserved_value);
            const reservedUntil = metadata.username_reserved_until ? new Date(metadata.username_reserved_until).getTime() : 0;

            return candidates.includes(username) || (reserved === username && reservedUntil > Date.now());
        });

        if (!match?.email) {
            return res.status(404).json({ error: 'Utilisateur introuvable.' });
        }

        const metadata = getUserMetadata(match);
        res.json({
            email: match.email,
            username: metadata.username || metadata.company_name || metadata.name || username,
            role: match.app_metadata?.role || metadata.role || null,
            status: metadata.status || null
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
