/**
 * NewKet Newsletter Manager
 * Handles subscriptions from the footer form.
 */

async function subscribeViaBackend(email, source) {
    if (window.ApiClient?.post) {
        return await window.ApiClient.post('/newsletter/subscribe', {
            email,
            source
        }, {
            suppressToast: true
        });
    }

    const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, source })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data?.error || 'Newsletter backend unavailable.');
        error.status = response.status;
        throw error;
    }

    return data;
}

async function subscribeLocally(email, source = 'footer') {
    const client = window.supabaseClient;
    if (!client) {
        return { success: false, message: 'Service temporairement indisponible.' };
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();
        const { data: existing } = await client
            .from('newsletter_subscribers')
            .select('id, status')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (existing) {
            if (existing.status === 'unsubscribed') {
                await client
                    .from('newsletter_subscribers')
                    .update({ status: 'active', source })
                    .eq('id', existing.id);
                return { success: true, message: 'Vous êtes de nouveau inscrit(e) !' };
            }
            return { success: true, message: 'Vous êtes déjà abonné(e) !' };
        }

        const { error } = await client
            .from('newsletter_subscribers')
            .insert({
                email: normalizedEmail,
                source,
                status: 'active',
                created_at: new Date().toISOString()
            });

        if (error) throw error;

        return { success: true, message: 'Inscription réussie ! Merci.' };
    } catch (err) {
        console.error('[Newsletter] Local subscribe error:', err);
        return { success: false, message: 'Une erreur est survenue. Réessayez.' };
    }
}

window.NewsletterManager = {
    async subscribe(email, source = 'footer') {
        if (!email || !email.includes('@')) {
            return { success: false, message: 'Adresse email invalide.' };
        }

        const normalizedEmail = email.toLowerCase().trim();

        try {
            const backendResult = await subscribeViaBackend(normalizedEmail, source);
            if (backendResult?.success) {
                return {
                    success: true,
                    message: backendResult.message || 'Inscription réussie ! Merci.',
                    brevoSynced: Boolean(backendResult.brevoSynced),
                    brevoSkipped: Boolean(backendResult.brevoSkipped)
                };
            }
        } catch (err) {
            console.warn('[Newsletter] Backend subscribe failed, falling back locally:', err);
        }

        return await subscribeLocally(normalizedEmail, source);
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
        msg.textContent = result.message || 'Inscription réussie !';
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

