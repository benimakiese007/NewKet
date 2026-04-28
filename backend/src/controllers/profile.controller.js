import { createUserSupabaseClient, hasServiceRoleKey, supabaseAdmin } from '../config/supabase.js';

function getProfileClient(req) {
    return hasServiceRoleKey ? supabaseAdmin : createUserSupabaseClient(req.token);
}

export const getMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifie' });

        const sb = getProfileClient(req);
        const { data, error } = await sb
            .from('users')
            .select('id, email, name, role, status, avatar, company_name, store_phone, cover_image, shipping_time, date_joined')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (!data) return res.json(null);
        res.json({ ...data, phone: data.store_phone || null });
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
        const allowed = {
            name: typeof updates.name === 'string' ? updates.name.trim() : undefined,
            store_phone: typeof updates.phone === 'string' ? updates.phone.trim() : undefined
        };
        Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);

        const { data, error } = await sb
            .from('users')
            .update({ ...allowed })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data: { ...data, phone: data?.store_phone || null } });
    } catch (err) {
        console.error('Erreur updateMyProfile:', err);
        res.status(500).json({ error: 'Erreur lors de la mise a jour du profil.' });
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

        const mimeType = dataUrlMatch[1] === 'image/jpg' ? 'image/jpeg' : dataUrlMatch[1];
        const fileBuffer = Buffer.from(dataUrlMatch[2], 'base64');

        if (!fileBuffer.length) {
            return res.status(400).json({ error: 'Image vide.' });
        }

        if (fileBuffer.length > 2 * 1024 * 1024) {
            return res.status(400).json({ error: 'Image trop lourde. Maximum 2 Mo.' });
        }

        const extensionMap = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/webp': 'webp'
        };
        const extension = extensionMap[mimeType] || 'jpg';
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
