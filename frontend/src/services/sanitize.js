/**
 * NewKet — XSS Sanitization Utility
 * Provides a global escapeHTML() function to safely inject user-controlled
 * data into innerHTML without risking Cross-Site Scripting (XSS) attacks.
 *
 * Usage:
 *   innerHTML = `<p>${escapeHTML(userInput)}</p>`
 */

/**
 * Escapes HTML special characters to neutralize potential XSS payloads.
 * @param {*} str - The value to sanitize (will be coerced to string).
 * @returns {string} A safe HTML string.
 */
export function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/`/g, '&#x60;');
}

/**
 * Sanitizes a URL to prevent javascript: protocol injection.
 * @param {string} url - The URL to validate.
 * @returns {string} A safe URL or '#' if dangerous.
 */
export function safeUrl(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:text/html')) return '#';
    return url;
}

// Expose globally for all scripts
window.escapeHTML = escapeHTML;
window.safeUrl = safeUrl;
