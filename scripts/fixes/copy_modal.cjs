const fs = require('fs');
const custHtml = fs.readFileSync('frontend/src/pages/customer-dashboard.html', 'utf8');

const startIndex = custHtml.indexOf('<div id="orderModal"');
if (startIndex !== -1) {
    const endStr = '<!-- End Order Modal -->';
    const endIndex = custHtml.indexOf(endStr, startIndex);
    if (endIndex !== -1) {
        const modalHtml = custHtml.substring(startIndex, endIndex + endStr.length);
        const vendHtml = fs.readFileSync('frontend/src/pages/vendor-dashboard.html', 'utf8');
        const newVendHtml = vendHtml.replace('</body>', modalHtml + '\n</body>');
        fs.writeFileSync('frontend/src/pages/vendor-dashboard.html', newVendHtml, 'utf8');
        console.log('Appended orderModal HTML successfully');
    } else {
        console.log('End of orderModal not found');
    }
} else {
    console.log('orderModal not found');
}
