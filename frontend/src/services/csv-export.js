// csv-export.js - Robust CSV export helpers (Excel-friendly)
//
// Goals:
// - Default delimiter ';' (works better with FR locale Excel)
// - Proper CSV escaping (quotes, delimiter, CR/LF)
// - UTF-8 BOM so Excel opens accents correctly by default
// - CRLF newlines for best compatibility

function csvEscape(value, delimiter = ';') {
    if (value === null || value === undefined) return '';
    const s = String(value);
    // Escape if it contains delimiter, quote, or line breaks
    if (s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function buildCsvString(headers, rows, opts = {}) {
    const delimiter = opts.delimiter || ';';
    const newline = opts.newline || '\r\n';

    const headerLine = Array.isArray(headers)
        ? headers.map((h) => csvEscape(h, delimiter)).join(delimiter)
        : '';

    const lines = [];
    if (headerLine) lines.push(headerLine);

    (rows || []).forEach((row) => {
        const arr = Array.isArray(row) ? row : [];
        lines.push(arr.map((v) => csvEscape(v, delimiter)).join(delimiter));
    });

    return lines.join(newline);
}

function downloadBlob(filename, mime, blobParts) {
    const blob = new Blob(blobParts, { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function downloadCsv(filename, headers, rows, opts = {}) {
    const delimiter = opts.delimiter || ';';
    const newline = opts.newline || '\r\n';
    const includeBom = opts.includeBom !== false; // default true

    const csv = buildCsvString(headers, rows, { delimiter, newline });
    const bom = includeBom ? '\uFEFF' : '';

    downloadBlob(
        filename,
        'text/csv;charset=utf-8;',
        [bom, csv]
    );
}

// Expose to non-module inline scripts (admin pages, vendor dashboard, etc.)
window.NewKetCsv = window.NewKetCsv || {};
window.NewKetCsv.escape = csvEscape;
window.NewKetCsv.build = buildCsvString;
window.NewKetCsv.download = downloadCsv;
window.NewKetCsv.downloadBlob = downloadBlob;

