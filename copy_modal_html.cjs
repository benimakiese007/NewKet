const fs = require('fs');
const custHtml = fs.readFileSync('frontend/src/pages/customer-dashboard.html', 'utf8');

const startStr = '<div id="orderModal"';
const startIndex = custHtml.indexOf(startStr);
const endStr = '    <script>';
const endIndex = custHtml.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const modalHtml = custHtml.substring(startIndex, endIndex);
    const vendHtml = fs.readFileSync('frontend/src/pages/vendor-dashboard.html', 'utf8');
    const newVendHtml = vendHtml.replace('</body>', modalHtml + '\n</body>');
    fs.writeFileSync('frontend/src/pages/vendor-dashboard.html', newVendHtml, 'utf8');
    console.log('Appended orderModal HTML successfully');
} else {
    console.log('Could not find boundaries');
}
