/**
 * NewKet — Bannière de consentement cookies RGPD
 * Conforme Art. 7 RGPD + Directive ePrivacy 2002/58/CE
 * Version : v1.1
 */

(function () {
    'use strict';

    // Application mobile native (Capacitor iOS & Android) : aucune bannière cookies web
    // Apple et Google déconseillent les bannières de cookies web dans les applications natives.
    const isNativeMobile = typeof window !== 'undefined' && (
        (window.Capacitor && (
            (typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
            window.Capacitor.isNative ||
            (typeof window.Capacitor.getPlatform === 'function' && ['ios', 'android'].includes(window.Capacitor.getPlatform()))
        )) ||
        (window.location && window.location.protocol === 'capacitor:') ||
        (window.origin && window.origin.includes('capacitor:')) ||
        (typeof navigator !== 'undefined' && /Capacitor/i.test(navigator.userAgent))
    );
    if (isNativeMobile) {
        return;
    }

    // Empêche les doubles injections quand la bannière est chargée à la fois
    // directement dans une page et via components-loader.js.
    if (window.__nkCookieConsentLoaded) {
        return;
    }
    window.__nkCookieConsentLoaded = true;
    window.cookieConsent = true;

    const CONSENT_KEY = 'nk_cookie_consent';
    const CONSENT_VERSION = 'v1.1';
    const API_CONSENT_URL = '/api/consent';

    // ─── Types de cookies ────────────────────────────────────────────────────────
    const COOKIE_TYPES = {
        functional: {
            label: 'Cookies fonctionnels',
            description: 'Nécessaires au fonctionnement du site (session, préférences). Ne peuvent pas être désactivés.',
            required: true,
        },
        analytics: {
            label: 'Cookies analytiques',
            description: 'Mesurent la fréquentation anonymement (Google Analytics). Aucune donnée personnelle transmise sans consentement.',
            required: false,
        },
        marketing: {
            label: 'Cookies marketing',
            description: 'Permettent de personnaliser les publicités. Désactivés par défaut.',
            required: false,
        },
    };

    // ─── Utilitaires ─────────────────────────────────────────────────────────────
    function getStoredConsent() {
        try {
            const raw = localStorage.getItem(CONSENT_KEY);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (obj.version !== CONSENT_VERSION) return null; // Version périmée → re-demander
            return obj;
        } catch {
            return null;
        }
    }

    function saveConsent(choices) {
        const payload = {
            version: CONSENT_VERSION,
            timestamp: new Date().toISOString(),
            choices, // { analytics: true/false, marketing: true/false, functional: true }
        };
        localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
        return payload;
    }

    function generateSessionId() {
        try {
            return sessionStorage.getItem('nk_session_id') || (() => {
                const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
                sessionStorage.setItem('nk_session_id', id);
                return id;
            })();
        } catch {
            return null;
        }
    }

    async function getAccessToken() {
        try {
            const { data } = await window.supabaseClient?.auth?.getSession?.();
            return data?.session?.access_token || null;
        } catch {
            return null;
        }
    }

    async function logConsentToAPI(consentType, consentGiven, accessToken = null) {
        try {
            await fetch(API_CONSENT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({
                    consent_given: consentGiven,
                    consent_type: consentType,
                    consent_version: CONSENT_VERSION,
                    session_id: generateSessionId(),
                }),
                keepalive: true,
            });
        } catch {
            // Silencieux : le consentement UI est déjà enregistré en localStorage
        }
    }

    async function logChoicesToAPI(choices) {
        // Une ligne par finalité permet de prouver un choix granulaire (et son
        // éventuel retrait), plutôt qu'un simple résumé « tout / rien ».
        const accessToken = await getAccessToken();
        await Promise.all([
            logConsentToAPI('functional', true, accessToken),
            logConsentToAPI('analytics', Boolean(choices.analytics), accessToken),
            logConsentToAPI('marketing', Boolean(choices.marketing), accessToken),
        ]);
    }

    // ─── Activation des traceurs selon consentement ───────────────────────────
    function applyConsent(choices) {
        // Google Analytics : chargement conditionnel
        if (choices.analytics) {
            if (!document.getElementById('nk-ga-script')) {
                const gaId = window.__NK_GA_ID__ || null;
                if (gaId) {
                    const s = document.createElement('script');
                    s.id = 'nk-ga-script';
                    s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
                    s.async = true;
                    document.head.appendChild(s);
                    window.dataLayer = window.dataLayer || [];
                    function gtag() { window.dataLayer.push(arguments); }
                    gtag('js', new Date());
                    gtag('config', gaId, { anonymize_ip: true });
                    window.gtag = gtag;
                }
            }
        } else {
            // Désactiver GA si refusé
            if (window.gtag) {
                window.gtag('consent', 'update', { analytics_storage: 'denied' });
            }
            // Supprimer les cookies GA existants
            ['_ga', '_gid', '_gat'].forEach(name => {
                document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname}`;
                document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname}`;
            });
        }

        // Dispatch global pour les autres modules de l'app
        window.dispatchEvent(new CustomEvent('nk:consent', { detail: choices }));
    }

    // ─── Création de la bannière ──────────────────────────────────────────────
    function createBanner() {
        const banner = document.createElement('div');
        banner.id = 'nk-cookie-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-modal', 'true');
        banner.setAttribute('aria-label', 'Préférences de cookies');
        banner.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 99999;
            padding: 1.25rem 1.5rem;
            background: #fff;
            border-top: 1px solid #e5e7eb;
            box-shadow: 0 -8px 40px rgba(0,0,0,0.12);
            font-family: 'Outfit', 'Inter', sans-serif;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            animation: nkBannerSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
        `;

        banner.innerHTML = `
            <style>
                @keyframes nkBannerSlideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                #nk-cookie-banner .nk-btn {
                    cursor: pointer;
                    border: none;
                    border-radius: 0.875rem;
                    font-weight: 700;
                    font-size: 0.8rem;
                    padding: 0.65rem 1.25rem;
                    transition: all 0.18s;
                    white-space: nowrap;
                    font-family: inherit;
                }
                #nk-cookie-banner .nk-btn-primary {
                    background: #013220;
                    color: #fff;
                }
                #nk-cookie-banner .nk-btn-primary:hover { background: #024d30; }
                #nk-cookie-banner .nk-btn-outline {
                    background: transparent;
                    color: #374151;
                    border: 1.5px solid #d1d5db;
                }
                #nk-cookie-banner .nk-btn-outline:hover { background: #f9fafb; }
                #nk-cookie-banner .nk-btn-ghost {
                    background: transparent;
                    color: #6b7280;
                    text-decoration: underline;
                    padding: 0.65rem 0.5rem;
                }
                #nk-cookie-panel {
                    display: none;
                    flex-direction: column;
                    gap: 0.75rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid #f3f4f6;
                    animation: nkFadeIn 0.2s ease;
                }
                @keyframes nkFadeIn { from { opacity:0; } to { opacity:1; } }
                #nk-cookie-panel.open { display: flex; }
                .nk-cookie-row {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 1rem;
                }
                .nk-cookie-row label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    font-size: 0.8rem;
                }
                .nk-toggle {
                    position: relative; width: 36px; height: 20px; flex-shrink: 0;
                }
                .nk-toggle input { opacity: 0; width: 0; height: 0; }
                .nk-slider {
                    position: absolute; inset: 0;
                    background: #d1d5db; border-radius: 20px;
                    transition: background 0.2s;
                    cursor: pointer;
                }
                .nk-slider:before {
                    content: '';
                    position: absolute;
                    height: 14px; width: 14px;
                    left: 3px; bottom: 3px;
                    background: #fff; border-radius: 50%;
                    transition: transform 0.2s;
                }
                .nk-toggle input:checked + .nk-slider { background: #013220; }
                .nk-toggle input:checked + .nk-slider:before { transform: translateX(16px); }
                .nk-toggle input:disabled + .nk-slider { opacity: 0.6; cursor: not-allowed; }
            </style>

            <div style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
                <div style="flex:1;min-width:220px;">
                    <p style="font-size:0.875rem;font-weight:700;color:#111827;margin:0 0 0.2rem;">🍪 Nous respectons votre vie privée</p>
                    <p style="font-size:0.75rem;color:#6b7280;margin:0;line-height:1.5;">
                        Nous utilisons des cookies pour améliorer votre expérience. Voir notre
                        <a href="/privacy" style="color:#013220;font-weight:600;text-decoration:underline;">politique de confidentialité</a>.
                    </p>
                </div>
                <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:nowrap;overflow-x:auto;padding-bottom:0.2rem;">
                    <button id="nk-cookie-customize" class="nk-btn nk-btn-ghost rounded-xl" style="padding-left:0.2rem;padding-right:0.2rem;">Personnaliser</button>
                    <button id="nk-cookie-reject" class="nk-btn nk-btn-outline rounded-xl" style="padding:0.65rem 0.75rem;">Refuser tout</button>
                    <button id="nk-cookie-accept" class="nk-btn nk-btn-primary rounded-xl" style="padding:0.65rem 0.75rem;">Accepter tout ✓</button>
                </div>
            </div>

            <!-- Panel personnalisation -->
            <div id="nk-cookie-panel">
                ${Object.entries(COOKIE_TYPES).map(([key, val]) => `
                    <div class="nk-cookie-row">
                        <div style="flex:1;">
                            <p style="font-size:0.8rem;font-weight:600;color:#111827;margin:0 0 0.15rem;">${val.label}${val.required ? ' <span style="font-size:0.65rem;background:#f3f4f6;border-radius:4px;padding:1px 5px;color:#6b7280;">Requis</span>' : ''}</p>
                            <p style="font-size:0.7rem;color:#9ca3af;margin:0;">${val.description}</p>
                        </div>
                        <label class="nk-toggle">
                            <input type="checkbox" id="nk-consent-${key}" aria-label="${val.label}" ${val.required ? 'checked disabled' : ''}>
                            <span class="nk-slider"></span>
                        </label>
                    </div>
                `).join('')}
                <div style="display:flex;justify-content:flex-end;padding-top:0.5rem;">
                    <button id="nk-cookie-save" class="nk-btn nk-btn-primary rounded-xl">Enregistrer mes choix</button>
                </div>
            </div>
        `;

        return banner;
    }

    // ─── Logique principale ───────────────────────────────────────────────────
    function hideBanner(banner) {
        banner.style.animation = 'nkBannerSlideDown 0.25s ease forwards';
        banner.style.cssText += 'animation: all 0.25s ease;';
        banner.style.transform = 'translateY(110%)';
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 300);
    }

    function init() {
        const existingBanner = document.getElementById('nk-cookie-banner');
        if (existingBanner) {
            window.cookieConsent = true;
            return;
        }

        const stored = getStoredConsent();
        if (stored) {
            // Consentement déjà donné et à jour → appliquer directement
            applyConsent(stored.choices);
            window.cookieConsent = true;
            return;
        }

        const banner = createBanner();
        document.body.appendChild(banner);
        window.cookieConsent = true;

        // Accepter tout
        document.getElementById('nk-cookie-accept').addEventListener('click', async () => {
            const choices = { functional: true, analytics: true, marketing: true };
            saveConsent(choices);
            applyConsent(choices);
            hideBanner(banner);
            await logChoicesToAPI(choices);
        });

        // Refuser tout (hors fonctionnels requis)
        document.getElementById('nk-cookie-reject').addEventListener('click', async () => {
            const choices = { functional: true, analytics: false, marketing: false };
            saveConsent(choices);
            applyConsent(choices);
            hideBanner(banner);
            await logChoicesToAPI(choices);
        });

        // Afficher/masquer personnalisation
        document.getElementById('nk-cookie-customize').addEventListener('click', () => {
            const panel = document.getElementById('nk-cookie-panel');
            panel.classList.toggle('open');
            document.getElementById('nk-cookie-customize').textContent =
                panel.classList.contains('open') ? 'Masquer' : 'Personnaliser';
        });

        // Enregistrer choix personnalisés
        document.getElementById('nk-cookie-save').addEventListener('click', async () => {
            const choices = {
                functional: true,
                analytics: document.getElementById('nk-consent-analytics').checked,
                marketing: document.getElementById('nk-consent-marketing').checked,
            };
            saveConsent(choices);
            applyConsent(choices);
            hideBanner(banner);
            await logChoicesToAPI(choices);
        });
    }

    // Lancer après chargement du DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // API publique pour réouvrir le panneau (ex: lien "Gérer les cookies" dans le footer)
    window.NewKetCookieConsent = {
        open() {
            const existing = document.getElementById('nk-cookie-banner');
            if (existing) existing.remove();
            localStorage.removeItem(CONSENT_KEY);
            init();
        },
        getChoices() {
            const stored = getStoredConsent();
            return stored ? stored.choices : null;
        },
    };
})();
