/**
 * verification.controller.js
 * Gère la certification "Vendeur Pro" via le RCCM.
 *
 * Flux :
 *   1. Vendor POST /api/verification/submit   → soumet RCCM + doc → status = 'pending'
 *   2. Admin  GET  /api/verification/pending   → liste les demandes en attente
 *   3. Admin  PUT  /api/verification/:id/approve → valide → seller_type='certified', status='approved'
 *   4. Admin  PUT  /api/verification/:id/reject  → refuse  → status='rejected' + motif
 */

import { supabaseAdmin, supabase } from '../config/supabase.js';
import EmailService from '../services/emailService.js';
import multer from 'multer';

// ─── Multer (mémoire) pour les fichiers RCCM ──────────────────────────────────
// On garde les fichiers en mémoire puis on les envoie dans Supabase Storage.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Format de fichier non autorisé. Utilisez JPG, PNG, WEBP ou PDF.'));
        }
    }
});

export const uploadRccmDoc = upload.single('rccm_document');

// ─── 1. Soumission par le vendeur ─────────────────────────────────────────────
export const submitVerification = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Non autorisé.' });
        }

        const { rccm_number, company_name } = req.body;

        if (!rccm_number || !rccm_number.trim()) {
            return res.status(400).json({ error: 'Le numéro RCCM est obligatoire.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Le document RCCM (photo ou PDF) est obligatoire.' });
        }

        const client = supabaseAdmin || supabase;

        // Vérifier que cet utilisateur est bien un vendeur
        const { data: user, error: userError } = await client
            .from('users')
            .select('id, name, email, role, business_verification_status')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'Utilisateur introuvable.' });
        }

        if (user.role !== 'supplier') {
            return res.status(403).json({ error: 'Seuls les vendeurs peuvent soumettre une demande de certification Pro.' });
        }

        if (user.business_verification_status === 'pending') {
            return res.status(409).json({ error: 'Une demande de certification est déjà en cours. Veuillez patienter.' });
        }

        if (user.business_verification_status === 'approved') {
            return res.status(409).json({ error: 'Votre boutique est déjà certifiée Pro.' });
        }

        // Upload du document dans Supabase Storage
        const fileExt = req.file.originalname.split('.').pop().toLowerCase();
        const fileName = `${userId}/rccm_${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await client
            .storage
            .from('vendor-documents')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (uploadError) {
            console.error('[Verification] Storage upload error:', uploadError);
            return res.status(500).json({ error: 'Erreur lors de l\'upload du document. Réessayez.' });
        }

        // Générer l'URL publique signée (valable 10 ans pour consultation admin)
        const { data: signedUrlData } = await client
            .storage
            .from('vendor-documents')
            .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10); // 10 ans

        const documentUrl = signedUrlData?.signedUrl || uploadData?.path;

        // Mettre à jour le profil vendeur
        const updatePayload = {
            rccm_number: rccm_number.trim().toUpperCase(),
            rccm_document_url: documentUrl,
            business_verification_status: 'pending',
            business_rejection_reason: null,
            business_verified_at: null,
        };

        if (company_name && company_name.trim()) {
            updatePayload.company_name = company_name.trim();
        }

        const { data: updatedUser, error: updateError } = await client
            .from('users')
            .update(updatePayload)
            .eq('id', userId)
            .select()
            .single();

        if (updateError) {
            console.error('[Verification] DB update error:', updateError);
            return res.status(500).json({ error: 'Erreur lors de l\'enregistrement de votre demande.' });
        }

        // Notification admin (best-effort)
        try {
            const { data: adminUsers } = await client
                .from('users')
                .select('email')
                .eq('role', 'admin');

            if (adminUsers?.length) {
                for (const admin of adminUsers) {
                    await EmailService.sendVerificationRequestAlert({
                        adminEmail: admin.email,
                        vendorName: user.name || 'Vendeur',
                        vendorEmail: user.email,
                        rccmNumber: rccm_number.trim().toUpperCase(),
                    });
                }
            }
        } catch (notifErr) {
            console.error('[Verification] Admin notification error (non-blocking):', notifErr.message);
        }

        console.log(`[Verification] Demande soumise par ${user.email} (RCCM: ${rccm_number})`);
        return res.status(200).json({
            success: true,
            message: 'Votre demande de certification Pro a bien été soumise. L\'équipe NewKet va examiner votre document.',
            status: 'pending'
        });

    } catch (err) {
        console.error('[Verification] submitVerification error:', err);
        return res.status(500).json({ error: 'Erreur interne. Réessayez plus tard.' });
    }
};

// ─── 2. Liste des demandes en attente (Admin) ──────────────────────────────────
export const getPendingVerifications = async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;

        const { data, error } = await client
            .from('users')
            .select(`
                id,
                name,
                email,
                company_name,
                shop_slug,
                avatar,
                rccm_number,
                rccm_document_url,
                business_verification_status,
                business_verified_at,
                business_rejection_reason,
                date_joined,
                total_sales,
                seller_score
            `)
            .eq('business_verification_status', 'pending')
            .order('date_joined', { ascending: true }); // Plus anciens en premier

        if (error) throw error;

        return res.status(200).json({ success: true, verifications: data || [] });
    } catch (err) {
        console.error('[Verification] getPendingVerifications error:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des demandes.' });
    }
};

// ─── 3. Approbation par l'admin ───────────────────────────────────────────────
export const approveVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const client = supabaseAdmin || supabase;

        // Récupérer le vendeur
        const { data: vendor, error: fetchError } = await client
            .from('users')
            .select('id, name, email, business_verification_status')
            .eq('id', id)
            .single();

        if (fetchError || !vendor) {
            return res.status(404).json({ error: 'Vendeur introuvable.' });
        }

        if (vendor.business_verification_status !== 'pending') {
            return res.status(400).json({ error: 'Cette demande n\'est pas en statut "pending".' });
        }

        // Approuver : seller_type = 'certified', status = 'approved'
        const { data: updatedVendor, error: updateError } = await client
            .from('users')
            .update({
                business_verification_status: 'approved',
                business_verified_at: new Date().toISOString(),
                business_rejection_reason: null,
                seller_type: 'certified',
                status: 'approved',
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Email de confirmation au vendeur
        try {
            await EmailService.sendVendorProApproved({
                vendorEmail: vendor.email,
                vendorName: vendor.name || 'Vendeur',
            });
        } catch (emailErr) {
            console.error('[Verification] Approval email error (non-blocking):', emailErr.message);
        }

        console.log(`[Verification] Approuvé: ${vendor.email}`);
        return res.status(200).json({
            success: true,
            message: `La boutique de ${vendor.name} est maintenant certifiée Pro.`,
            user: updatedVendor
        });

    } catch (err) {
        console.error('[Verification] approveVerification error:', err);
        return res.status(500).json({ error: 'Erreur lors de l\'approbation.' });
    }
};

// ─── 4. Rejet par l'admin ─────────────────────────────────────────────────────
export const rejectVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Un motif de refus est obligatoire pour informer le vendeur.' });
        }

        const client = supabaseAdmin || supabase;

        const { data: vendor, error: fetchError } = await client
            .from('users')
            .select('id, name, email, business_verification_status')
            .eq('id', id)
            .single();

        if (fetchError || !vendor) {
            return res.status(404).json({ error: 'Vendeur introuvable.' });
        }

        if (vendor.business_verification_status !== 'pending') {
            return res.status(400).json({ error: 'Cette demande n\'est pas en statut "pending".' });
        }

        const { data: updatedVendor, error: updateError } = await client
            .from('users')
            .update({
                business_verification_status: 'rejected',
                business_verified_at: new Date().toISOString(),
                business_rejection_reason: reason.trim(),
                // On ne change PAS seller_type — le vendeur reste normal
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Email de refus au vendeur
        try {
            await EmailService.sendVendorProRejected({
                vendorEmail: vendor.email,
                vendorName: vendor.name || 'Vendeur',
                reason: reason.trim(),
            });
        } catch (emailErr) {
            console.error('[Verification] Rejection email error (non-blocking):', emailErr.message);
        }

        console.log(`[Verification] Rejeté: ${vendor.email} — Motif: ${reason}`);
        return res.status(200).json({
            success: true,
            message: `La demande de ${vendor.name} a été refusée.`,
            user: updatedVendor
        });

    } catch (err) {
        console.error('[Verification] rejectVerification error:', err);
        return res.status(500).json({ error: 'Erreur lors du refus.' });
    }
};

// ─── 5. Récupération du statut de vérification du vendeur connecté ────────────
export const getMyVerificationStatus = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Non autorisé.' });

        const client = supabaseAdmin || supabase;

        const { data, error } = await client
            .from('users')
            .select('business_verification_status, business_verified_at, business_rejection_reason, rccm_number, seller_type')
            .eq('id', userId)
            .single();

        if (error) throw error;

        return res.status(200).json({ success: true, verification: data });
    } catch (err) {
        console.error('[Verification] getMyVerificationStatus error:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération du statut.' });
    }
};
