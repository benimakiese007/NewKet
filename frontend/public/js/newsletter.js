/**
 * NewKet Newsletter Manager
 * Handles subscriptions from the footer form — saves to Supabase.
 */
window.NewsletterManager = {

    async subscribe(email, source = 'footer') {
        if (!email || !email.includes('@')) {
            return { success: false, message: 'Adresse email invalide.' };
        }

        const client = window.supabaseClient;
        if (!client) {
            return { success: false, message: 'Service temporairement indisponible.' };
        }

        try {
            // Check if already subscribed
            const { data: existing } = await client
                .from('newsletter_subscribers')
                .select('id, status')
                .eq('email', email.toLowerCase().trim())
                .maybeSingle();

            if (existing) {
                if (existing.status === 'unsubscribed') {
                    // Re-subscribe
                    await client
                        .from('newsletter_subscribers')
                        .update({ status: 'active', source })
                        .eq('id', existing.id);
                    return { success: true, message: '✅ Vous êtes de nouveau inscrit(e) !' };
                }
                return { success: true, message: '✅ Vous êtes déjà abonné(e) !' };
            }

            // New subscriber
            const { error } = await client
                .from('newsletter_subscribers')
                .insert({
                    email: email.toLowerCase().trim(),
                    source,
                    status: 'active',
                    created_at: new Date().toISOString()
                });

            if (error) throw error;

            return { success: true, message: '✅ Inscription réussie ! Merci.' };

        } catch (err) {
            console.error('[Newsletter] Subscribe error:', err);
            return { success: false, message: 'Une erreur est survenue. Réessayez.' };
        }
    }
};

// Global handler for footer form
window.handleNewsletterSubmit = async function(event) {
    event.preventDefault();

    const emailInput = document.getElementById('newsletterEmail');
    const btn = document.getElementById('newsletterBtn');
    const msg = document.getElementById('newsletterMsg');

    if (!emailInput || !btn) return;

    const email = emailInput.value.trim();
    btn.disabled = true;
    btn.textContent = '...';

    const result = await NewsletterManager.subscribe(email, 'footer');

    if (msg) {
        msg.textContent = result.message;
        msg.classList.remove('hidden');
        msg.style.color = result.success ? '#4ade80' : '#f87171';
    }

    if (result.success) {
        emailInput.value = '';
        setTimeout(() => {
            if (msg) msg.classList.add('hidden');
        }, 5000);
    }

    btn.disabled = false;
    btn.textContent = "S'inscrire";
};
