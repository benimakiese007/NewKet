import QRCode from 'qrcode';

function buildInvoiceQrTargetUrl(order, qrReference) {
    const baseUrl = window.location.origin;
    if (!order?.id) {
        // Fallback si pas d'ID (ne devrait pas arriver)
        return new URL('/src/pages/invoice-verify.html', baseUrl).toString();
    }
    const url = new URL(`/facture/${order.id}`, baseUrl);
    if (qrReference) url.searchParams.set('invoice_ref', qrReference);
    return url.toString();
}

async function toDataUrl(text) {
    return QRCode.toDataURL(text, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220,
        color: {
            dark: '#0f172a',
            light: '#ffffff'
        }
    });
}

window.InvoiceQrService = {
    buildInvoiceQrTargetUrl,
    toDataUrl
};
