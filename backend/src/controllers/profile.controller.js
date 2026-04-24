import { supabaseAdmin } from '../config/supabase.js';

export const getMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifie' });

        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id, email, name, role, status, avatar, company_name, phone, bio, province_id, commune_id, quartier_id, created_at, updated_at')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        res.json(data || null);
    } catch (err) {
        console.error('Erreur getMyProfile:', err);
        res.status(500).json({ error: 'Erreur lors de la recuperation du profil.' });
    }
};

export const updateMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifie' });

        const updates = req.body;

        const { data, error } = await supabaseAdmin
            .from('users')
            .upsert({ ...updates, id: userId, updated_at: new Date().toISOString() })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('Erreur updateMyProfile:', err);
        res.status(500).json({ error: 'Erreur lors de la mise a jour du profil.' });
    }
};

export const uploadMyAvatar = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifie' });

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

        const { error: uploadError } = await supabaseAdmin
            .storage
            .from('user-assets')
            .upload(filePath, fileBuffer, {
                contentType: mimeType,
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabaseAdmin
            .storage
            .from('user-assets')
            .getPublicUrl(filePath);

        const publicUrl = publicUrlData?.publicUrl;
        if (!publicUrl) {
            return res.status(500).json({ error: 'URL publique introuvable.' });
        }

        const { error: profileError } = await supabaseAdmin
            .from('users')
            .update({ avatar: publicUrl, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (profileError) throw profileError;

        try {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
                user_metadata: { avatar_url: publicUrl }
            });
        } catch (authError) {
            console.warn('Avertissement updateUserById avatar:', authError);
        }

        res.json({ success: true, avatar: publicUrl });
    } catch (err) {
        console.error('Erreur uploadMyAvatar:', err);
        res.status(500).json({ error: 'Erreur lors de l\'upload de l\'avatar.' });
    }
};
