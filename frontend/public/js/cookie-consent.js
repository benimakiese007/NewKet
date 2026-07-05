class CookieConsent {
    constructor() {
        this.consentKey = 'newket_cookie_consent';
        this.modalHtml = `
            <div id="cookie-consent-overlay" class="cookie-consent-overlay"></div>
            <div id="cookie-consent-modal" class="cookie-consent-modal">
                <div class="cookie-content">
                    <div class="cookie-header">
                        <svg class="cookie-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                            <circle cx="8.5" cy="10.5" r="1.5" fill="currentColor"/>
                            <circle cx="14.5" cy="15.5" r="1.5" fill="currentColor"/>
                            <circle cx="10" cy="16" r="1" fill="currentColor"/>
                        </svg>
                        <h3 class="cookie-title">Nous utilisons des cookies</h3>
                    </div>
                    <p class="cookie-text">
                        Nous utilisons des cookies pour améliorer votre expérience sur NewKet, analyser le trafic de notre plateforme et sécuriser vos sessions. 
                        En continuant votre navigation, vous acceptez notre <a href="/src/pages/privacy.html" class="underline font-bold">Politique de confidentialité</a>.
                    </p>
                    <div class="cookie-actions">
                        <button id="btn-cookie-decline" class="btn-cookie-decline">Refuser l'essentiel</button>
                        <button id="btn-cookie-accept" class="btn-cookie-accept">Accepter tout</button>
                    </div>
                </div>
            </div>
        `;
        this.init();
    }

    init() {
        // Vérifier si le consentement a déjà été donné
        const hasConsent = this.getCookie(this.consentKey);
        
        // Ne pas afficher la modale sur la page de politique de confidentialité
        if (window.location.pathname.includes('privacy.html')) {
            return;
        }

        if (!hasConsent) {
            // Attendre que le DOM soit chargé
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.showModal());
            } else {
                this.showModal();
            }
        } else if (hasConsent === 'accepted') {
            this.enableAnalytics();
        }
    }

    showModal() {
        // Éviter les doublons
        if (document.getElementById('cookie-consent-modal')) return;

        // Injecter le modal dans le body
        document.body.insertAdjacentHTML('beforeend', this.modalHtml);
        
        const modal = document.getElementById('cookie-consent-modal');
        const acceptBtn = document.getElementById('btn-cookie-accept');
        const declineBtn = document.getElementById('btn-cookie-decline');

        const overlay = document.getElementById('cookie-consent-overlay');

        // Ajouter un petit délai pour l'animation d'apparition
        setTimeout(() => {
            modal.classList.add('active');
            if(overlay) overlay.classList.add('active');
        }, 500);

        // Event listeners
        acceptBtn.addEventListener('click', () => this.handleConsent('accepted', modal));
        declineBtn.addEventListener('click', () => this.handleConsent('declined', modal));
    }

    handleConsent(status, modal) {
        this.setCookie(this.consentKey, status, 365); // Valable 1 an
        const overlay = document.getElementById('cookie-consent-overlay');
        
        // Animation de fermeture
        modal.classList.remove('active');
        if(overlay) overlay.classList.remove('active');
        
        setTimeout(() => {
            modal.remove();
            if(overlay) overlay.remove();
        }, 400);

        if (status === 'accepted') {
            this.enableAnalytics();
        }
    }

    enableAnalytics() {
        // Placeholder pour l'initialisation des scripts tiers (Google Analytics, Pixels, etc.)
        // console.log("Cookies analytiques activés.");
    }

    setCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        // path=/ permet au cookie d'être lu sur toutes les pages
        document.cookie = name + "=" + (value || "")  + expires + "; path=/; SameSite=Lax";
    }

    getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for(let i=0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }
}

// Initialisation globale
window.cookieConsent = new CookieConsent();
