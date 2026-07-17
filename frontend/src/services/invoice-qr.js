import QRCode from 'qrcode';

function buildInvoiceQrTargetUrl(order, qrReference) {
    const resolvedPath = typeof window.resolvePath === 'function'
        ? window.resolvePath('invoice-verify')
        : '/src/pages/invoice-verify.html';
    const url = new URL(resolvedPath, window.location.origin);
    if (order?.id) url.searchParams.set('order_id', order.id);
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
